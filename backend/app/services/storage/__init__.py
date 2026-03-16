"""
Storage 工廠 / Storage Factory
根據環境變數 STORAGE_BACKEND 決定使用哪個實作。
Selects storage implementation based on STORAGE_BACKEND env var.

可選值 / Options:
  local   → 本地檔案系統（預設，Railway 保持不變）Local filesystem (default, Railway unchanged)
  sheets  → Google Sheets（前期測試用）Google Sheets (for early testing)
  supabase → Supabase PostgreSQL（正式上線）Supabase PostgreSQL (production)
"""
import os
import logging
from .base import StorageBase

logger = logging.getLogger(__name__)

_storage_instance: StorageBase | None = None


def get_storage() -> StorageBase:
    """
    取得 Storage 單例 / Get storage singleton.
    第一次呼叫時根據 STORAGE_BACKEND 建立實例，之後重用。
    Creates instance on first call based on STORAGE_BACKEND, reuses thereafter.
    """
    global _storage_instance
    if _storage_instance is not None:
        return _storage_instance

    backend = os.getenv("STORAGE_BACKEND", "local").lower().strip()
    logger.info(f"Initializing storage backend: {backend}")

    if backend == "sheets":
        from .sheets import SheetsStorage
        _storage_instance = SheetsStorage()
    elif backend == "supabase":
        from .supabase import SupabaseStorage
        _storage_instance = SupabaseStorage()
    else:
        from .local import LocalStorage
        _storage_instance = LocalStorage()

    return _storage_instance
