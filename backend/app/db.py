"""
PostgreSQL 連線池與資料表初始化 / PostgreSQL Connection Pool & Table Init
使用 asyncpg — 原生非同步，無 ORM。
Uses asyncpg — native async, no ORM.
"""
import os
import logging
import asyncpg

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """取得（或建立）全域連線池 / Get (or create) the global connection pool."""
    global _pool
    if _pool is None:
        url = os.getenv("DATABASE_URL", "")
        if not url:
            raise RuntimeError("Missing env var: DATABASE_URL")
        # asyncpg 接受 postgresql:// 或 postgres:// / asyncpg accepts both schemes
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        _pool = await asyncpg.create_pool(
            url,
            min_size=2,
            max_size=10,
            ssl="require",
            command_timeout=30,
        )
        logger.info("PostgreSQL connection pool created")
    return _pool


async def close_pool() -> None:
    """關閉連線池（應用程式關閉時呼叫）/ Close pool on app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")


async def init_tables() -> None:
    """
    建立所有資料表（若不存在）。
    Create all tables if they don't exist.
    冪等操作，可安全重複呼叫。/ Idempotent — safe to call repeatedly.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # ── 分析事件 / Analytics Events ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS analytics_events (
                id          BIGSERIAL PRIMARY KEY,
                ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                device_id_hash TEXT NOT NULL,
                event_type  TEXT NOT NULL,
                page        TEXT NOT NULL DEFAULT '',
                extra       JSONB NOT NULL DEFAULT '{}'
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_analytics_ts "
            "ON analytics_events (ts DESC)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_analytics_event_type "
            "ON analytics_events (event_type)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_analytics_device "
            "ON analytics_events (device_id_hash)"
        )

        # ── 公告 / Announcements ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS announcements (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title       TEXT NOT NULL,
                body        TEXT NOT NULL DEFAULT '',
                type        TEXT NOT NULL DEFAULT 'info',
                target      TEXT NOT NULL DEFAULT 'all',
                published_at TIMESTAMPTZ,
                expires_at  TIMESTAMPTZ,
                link_url    TEXT,
                link_label  TEXT,
                version     INTEGER NOT NULL DEFAULT 1
            )
        """)

        # ── 管理員帳號 / Admin Accounts ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS admin_accounts (
                username    TEXT PRIMARY KEY,
                bcrypt_hash TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                is_active   BOOLEAN NOT NULL DEFAULT TRUE
            )
        """)

        # ── 意見回饋 / Feedback ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                category    TEXT NOT NULL DEFAULT '',
                content     TEXT NOT NULL,
                contact     TEXT,
                device_id_hash TEXT NOT NULL DEFAULT '',
                status      TEXT NOT NULL DEFAULT 'pending',
                admin_reply TEXT,
                replied_at  TIMESTAMPTZ
            )
        """)

        # ── 共享平台 / Shared Items ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS shared_items (
                code        TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                body        TEXT,
                link_urls   JSONB NOT NULL DEFAULT '[]',
                device_id_hash TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
                password_hash TEXT
            )
        """)

        # ── 跨裝置同步 / User Sync ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_sync (
                student_id_hash TEXT PRIMARY KEY,
                tasks_json  JSONB NOT NULL DEFAULT '[]',
                shares_json JSONB NOT NULL DEFAULT '[]',
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        # ── 應用設定 / App Config ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS app_config (
                key         TEXT PRIMARY KEY,
                value       TEXT NOT NULL DEFAULT ''
            )
        """)

        # ── 同步紀錄 / Sync Logs ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS sync_logs (
                id          BIGSERIAL PRIMARY KEY,
                ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                sync_type   TEXT NOT NULL,
                student_id_anon TEXT NOT NULL,
                status      TEXT NOT NULL,
                duration_ms INTEGER NOT NULL DEFAULT 0
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_logs_ts "
            "ON sync_logs (ts DESC)"
        )

        # ── PWA 推播訂閱 / Push Subscriptions ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                endpoint    TEXT PRIMARY KEY,
                device_id   TEXT NOT NULL DEFAULT '',
                p256dh      TEXT NOT NULL,
                auth        TEXT NOT NULL,
                subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

    logger.info("PostgreSQL tables initialized successfully")
