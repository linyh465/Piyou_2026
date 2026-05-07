"""
自動休眠引擎 / Auto-Hibernate Engine
當伺服器閒置超過設定時間後，自動清除所有記憶體快取並觸發 GC，
讓 vCPU、RAM、Networking 消耗降至最低。
When the server is idle beyond a threshold, automatically purges all
in-memory caches and triggers GC to minimize vCPU, RAM, and Networking.

設計原則 / Design principles:
- touch()：每個請求呼叫一次（由最外層 middleware 觸發），僅更新時間戳
- _check_and_hibernate()：由背景排程定期呼叫，檢查是否該進入休眠
- 喚醒是隱式的 — 下一個請求會觸發 lazy cache rebuild，不需特殊處理
"""
import gc
import time
import asyncio
import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

# ── 設定 / Configuration ──
IDLE_THRESHOLD_SECONDS = 5 * 60    # 5 分鐘無請求即進入休眠 / 5 min idle → hibernate
CHECK_INTERVAL_SECONDS = 60         # 每 60 秒檢查一次 / Check every 60s
DISK_CACHE_MAX_AGE = 3600           # 磁碟快取超過 1 小時即刪除 / Delete disk cache > 1h
TASK_FILE_MAX_AGE = 30 * 86400      # 任務檔案超過 30 天即刪除 / Delete task files > 30d


class HibernateManager:
    """
    全域休眠管理器（單例）/ Global hibernate manager (singleton).
    追蹤最後活動時間，閒置時自動清除快取。
    Tracks last activity time; purges caches when idle.
    """

    def __init__(self):
        self._last_activity: float = time.time()
        self._is_hibernating: bool = False
        self._lock = threading.Lock()
        self._task: asyncio.Task | None = None
        self._stopping: bool = False

    def touch(self) -> None:
        """
        記錄活動（由 middleware 呼叫）/ Record activity (called by middleware).
        極低成本：僅一次 time.time() + 賦值。
        Very cheap: just time.time() + assignment.
        """
        now = time.time()
        self._last_activity = now
        if self._is_hibernating:
            with self._lock:
                if self._is_hibernating:
                    self._is_hibernating = False
                    logger.info("☀️ Waking up from hibernate / 從休眠中喚醒")

    @property
    def is_hibernating(self) -> bool:
        return self._is_hibernating

    @property
    def idle_seconds(self) -> float:
        return time.time() - self._last_activity

    def _purge_all_caches(self) -> None:
        """
        清除所有記憶體快取（同步）/ Purge all in-memory caches (sync).
        在背景排程的 asyncio.to_thread 中執行。
        Runs inside asyncio.to_thread from the background scheduler.
        """
        purged: list[str] = []

        # 1. Scraper session 快取 / Scraper session caches
        try:
            from app.services.scraper_cache import _scraper_cache, _library_cache
            count_s = len(_scraper_cache)
            count_l = len(_library_cache)
            _scraper_cache.clear()
            _library_cache.clear()
            if count_s or count_l:
                purged.append(f"scraper sessions ({count_s}+{count_l})")
        except Exception as exc:
            logger.debug(f"hibernate: scraper cache clear skipped: {exc}")

        # 2. Analytics 快取 / Analytics caches
        try:
            import app.services.storage.sheets_analytics as sa
            sa.invalidate_stats_cache()
            with sa._QUEUE_LOCK:
                if sa._EVENT_QUEUE:
                    # 休眠前先嘗試 flush 殘留事件 / Flush remaining events before hibernate
                    pending = sa._EVENT_QUEUE[:]
                    sa._EVENT_QUEUE.clear()
                    if pending:
                        try:
                            sa._flush_events_sync(pending)
                            purged.append(f"analytics flush ({len(pending)} events)")
                        except Exception:
                            pass
            # 釋放 Google Sheets API service 物件 / Release Sheets API service object
            sa._SERVICE_CACHE = None
            purged.append("analytics cache + service")
        except Exception as exc:
            logger.debug(f"hibernate: analytics clear skipped: {exc}")

        # 3. 公告 & 回饋快取 / Announcements & feedback caches
        try:
            from app.services.storage.sheets_notify import (
                invalidate_announcements_cache, _fb_cache,
            )
            invalidate_announcements_cache()
            _fb_cache.clear()
            purged.append("announcements + feedback")
        except Exception as exc:
            logger.debug(f"hibernate: notify clear skipped: {exc}")

        # 4. IP 追蹤器 & 速率限制器 / IP tracker & rate limiter
        try:
            from app.middleware.security import ip_tracker, sync_cooldown
            ip_count = len(ip_tracker._ips)
            ip_tracker._ips.clear()
            ip_tracker._rate_limit_hits.clear()
            sync_cooldown._records.clear()
            if ip_count:
                purged.append(f"IP tracker ({ip_count} IPs)")
        except Exception as exc:
            logger.debug(f"hibernate: security clear skipped: {exc}")

        # 5. 公車記憶體快取 / Bus in-memory caches
        try:
            import app.routers.data as data_mod
            data_mod._bus_mem_cache = None
            data_mod._bus_mem_cache_at = 0
            data_mod._route_stops_cache = None
            data_mod._route_stops_cache_at = 0
            purged.append("bus caches")
        except Exception as exc:
            logger.debug(f"hibernate: bus cache clear skipped: {exc}")

        # 6. TDX service token / TDX token release
        # TDXService 是每次 new 的，沒有全域 singleton，不需清理

        # 7. 強制 GC / Force garbage collection
        collected = gc.collect()
        purged.append(f"GC collected {collected} objects")

        logger.info(f"🛌 Hibernate purge complete: {', '.join(purged)}")

    async def _scheduler_loop(self) -> None:
        """
        背景排程：每 CHECK_INTERVAL_SECONDS 檢查一次閒置狀態。
        Background scheduler: checks idle status every CHECK_INTERVAL_SECONDS.
        """
        logger.info(f"🕰️ Hibernate scheduler started (idle threshold: {IDLE_THRESHOLD_SECONDS}s)")
        while not self._stopping:
            try:
                await asyncio.sleep(CHECK_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                break

            if self._stopping:
                break

            idle = self.idle_seconds
            if idle >= IDLE_THRESHOLD_SECONDS and not self._is_hibernating:
                logger.info(
                    f"🛌 Entering hibernate (idle {int(idle)}s > threshold {IDLE_THRESHOLD_SECONDS}s) "
                    f"/ 進入休眠（閒置 {int(idle)} 秒）"
                )
                with self._lock:
                    self._is_hibernating = True
                try:
                    await asyncio.to_thread(self._purge_all_caches)
                except Exception as exc:
                    logger.warning(f"Hibernate purge error (non-fatal): {exc}")

        logger.info("🕰️ Hibernate scheduler stopped")

    def start(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        """啟動背景排程 / Start background scheduler."""
        self._stopping = False
        self._last_activity = time.time()
        self._task = asyncio.ensure_future(self._scheduler_loop())

    def stop(self) -> None:
        """停止背景排程 / Stop background scheduler."""
        self._stopping = True
        if self._task and not self._task.done():
            self._task.cancel()


def cleanup_disk_cache(cache_dir: Path) -> None:
    """
    啟動時清理磁碟暫存 / Clean up disk cache on startup.
    - cache/*.json 超過 DISK_CACHE_MAX_AGE → 刪除
    - cache/tasks/*.json 超過 TASK_FILE_MAX_AGE → 刪除
    """
    now = time.time()
    deleted_count = 0

    # 清理公車快取等 JSON / Clean bus cache JSONs
    if cache_dir.exists():
        for f in cache_dir.glob("*.json"):
            try:
                age = now - f.stat().st_mtime
                if age > DISK_CACHE_MAX_AGE:
                    f.unlink()
                    deleted_count += 1
            except Exception as exc:
                logger.debug(f"cleanup_disk_cache: {f.name}: {exc}")

    # 清理任務快取 / Clean task cache
    tasks_dir = cache_dir / "tasks"
    if tasks_dir.exists():
        for f in tasks_dir.glob("*.json"):
            try:
                age = now - f.stat().st_mtime
                if age > TASK_FILE_MAX_AGE:
                    f.unlink()
                    deleted_count += 1
            except Exception as exc:
                logger.debug(f"cleanup_disk_cache tasks: {f.name}: {exc}")

    if deleted_count:
        logger.info(f"🧹 Disk cache cleanup: deleted {deleted_count} stale files / 清理 {deleted_count} 個過期暫存檔")
    else:
        logger.info("🧹 Disk cache cleanup: no stale files found / 無過期暫存檔")


# 全域單例 / Global singleton
hibernate_manager = HibernateManager()
