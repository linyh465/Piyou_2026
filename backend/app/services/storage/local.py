"""
Local Storage 實作 / Local Storage Implementation
使用本地檔案系統儲存任務，與原有 Railway 行為完全相同。
Uses local filesystem for task storage — identical to original Railway behavior.

適用情境 / Use case:
  STORAGE_BACKEND=local（預設）/ default
"""
import json
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from .base import StorageBase

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "cache"
TASKS_DIR = CACHE_DIR / "tasks"
MAX_TASKS = 500


def _ensure_dirs():
    CACHE_DIR.mkdir(exist_ok=True)
    TASKS_DIR.mkdir(exist_ok=True)


def _safe_id(student_id: str) -> str:
    return "".join(c for c in student_id if c.isalnum())


def _read(student_id: str) -> dict | None:
    _ensure_dirs()
    path = TASKS_DIR / f"{_safe_id(student_id)}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"LocalStorage read error: {e}")
        return None


def _write(student_id: str, tasks: list) -> None:
    _ensure_dirs()
    path = TASKS_DIR / f"{_safe_id(student_id)}.json"
    data = {"tasks": tasks, "updated_at": datetime.now(timezone.utc).isoformat()}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"LocalStorage: saved {len(tasks)} tasks")


class LocalStorage(StorageBase):
    async def get_tasks(self, student_id: str) -> dict | None:
        return await asyncio.to_thread(_read, student_id)

    async def set_tasks(self, student_id: str, tasks: list) -> None:
        await asyncio.to_thread(_write, student_id, tasks)
