"""
Supabase Storage 實作 / Supabase Storage Implementation
使用 Supabase PostgreSQL 作為任務儲存後端（正式上線用）。
Uses Supabase PostgreSQL as task storage backend (for production).

必要環境變數 / Required env vars:
  SUPABASE_URL          Supabase 專案 URL（https://xxxx.supabase.co）
  SUPABASE_SERVICE_KEY  Service Role Key（非 anon key）

資料表結構 / Table schema（在 Supabase SQL Editor 執行）:
  CREATE TABLE tasks (
    student_id  TEXT PRIMARY KEY,
    tasks_json  JSONB NOT NULL DEFAULT '[]',
    updated_at  TIMESTAMPTZ DEFAULT now()
  );

切換方式 / How to activate:
  設定環境變數 STORAGE_BACKEND=supabase
  Set env var STORAGE_BACKEND=supabase
"""
import json
import logging
import asyncio
import os
from datetime import datetime, timezone
from .base import StorageBase

logger = logging.getLogger(__name__)


def _get_client():
    """建立 Supabase client / Build Supabase client."""
    try:
        from supabase import create_client
    except ImportError as e:
        raise RuntimeError(
            "缺少 supabase 套件，請執行：pip install supabase\n"
            f"Missing supabase package: {e}"
        ) from e

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise RuntimeError(
            "缺少環境變數 SUPABASE_URL 或 SUPABASE_SERVICE_KEY\n"
            "Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_KEY"
        )
    return create_client(url, key)


def _read_sync(student_id: str) -> dict | None:
    client = _get_client()
    result = (
        client.table("tasks")
        .select("tasks_json, updated_at")
        .eq("student_id", student_id)
        .maybe_single()
        .execute()
    )
    if result.data is None:
        return None
    return {
        "tasks": result.data["tasks_json"],
        "updated_at": result.data.get("updated_at", ""),
    }


def _write_sync(student_id: str, tasks: list) -> None:
    client = _get_client()
    now = datetime.now(timezone.utc).isoformat()
    (
        client.table("tasks")
        .upsert(
            {"student_id": student_id, "tasks_json": tasks, "updated_at": now},
            on_conflict="student_id",
        )
        .execute()
    )
    logger.info(f"SupabaseStorage: upserted {len(tasks)} tasks for student")


class SupabaseStorage(StorageBase):
    async def get_tasks(self, student_id: str) -> dict | None:
        return await asyncio.to_thread(_read_sync, student_id)

    async def set_tasks(self, student_id: str, tasks: list) -> None:
        await asyncio.to_thread(_write_sync, student_id, tasks)
