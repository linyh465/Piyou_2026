"""
Storage 抽象介面 / Storage Abstract Base
定義任務儲存的統一規格，讓 Router 不依賴底層實作。
Defines the unified interface for task storage, decoupling the router from implementation.
"""
from abc import ABC, abstractmethod


class StorageBase(ABC):
    """
    任務儲存介面 / Task Storage Interface

    回傳格式 / Return format:
        get_tasks → {"tasks": [...], "updated_at": "ISO8601"} 或 None（無資料時）
        set_tasks → None
    """

    @abstractmethod
    async def get_tasks(self, student_id: str) -> dict | None:
        """
        取得該學號的任務資料 / Get tasks for student_id.
        回傳 {"tasks": list, "updated_at": str} 或 None（無資料）
        Returns {"tasks": list, "updated_at": str} or None if not found.
        """
        ...

    @abstractmethod
    async def set_tasks(self, student_id: str, tasks: list) -> None:
        """
        覆寫該學號的任務資料 / Overwrite tasks for student_id.
        """
        ...
