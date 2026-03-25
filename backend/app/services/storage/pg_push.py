"""
PWA 推播訂閱儲存（PostgreSQL）/ Push Subscription Storage (PostgreSQL)
公開 API 與 sheets_push.py 完全相同。
Public API is identical to sheets_push.py.

push_subscriptions 欄位 / Columns:
  device_id  endpoint (PK)  p256dh  auth  subscribed_at
"""
import logging

from app.db import get_pool

logger = logging.getLogger(__name__)


async def save_subscription(device_id: str, endpoint: str, p256dh: str, auth: str) -> None:
    """新增或更新推播訂閱 / Save or update push subscription (upsert by endpoint)."""
    pool = await get_pool()
    await pool.execute("""
        INSERT INTO push_subscriptions (device_id, endpoint, p256dh, auth, subscribed_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (endpoint) DO UPDATE SET
            device_id     = EXCLUDED.device_id,
            p256dh        = EXCLUDED.p256dh,
            auth          = EXCLUDED.auth,
            subscribed_at = NOW()
    """, device_id, endpoint, p256dh, auth)
    logger.info(f"pg_push: saved subscription device={device_id[:8]}…")


async def remove_subscription(endpoint: str) -> None:
    """移除推播訂閱 / Remove push subscription by endpoint."""
    pool = await get_pool()
    await pool.execute("DELETE FROM push_subscriptions WHERE endpoint = $1", endpoint)
    logger.info("pg_push: removed subscription")


async def get_all_subscriptions() -> list[dict]:
    """取得所有有效訂閱 / Get all valid subscriptions."""
    pool = await get_pool()
    rows = await pool.fetch("""
        SELECT device_id, endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL
    """)
    return [
        {
            "device_id": r["device_id"] or "",
            "endpoint": r["endpoint"],
            "p256dh": r["p256dh"],
            "auth": r["auth"],
        }
        for r in rows
    ]
