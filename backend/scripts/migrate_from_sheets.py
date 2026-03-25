"""
一次性資料移轉腳本：Google Sheets → PostgreSQL
One-time data migration script: Google Sheets → PostgreSQL

使用方式 / Usage:
    cd backend
    python -m scripts.migrate_from_sheets

環境變數需求 / Required env vars:
    DATABASE_URL              — PostgreSQL 連線字串
    GOOGLE_SERVICE_ACCOUNT_JSON — Google Service Account JSON
    GOOGLE_SHEETS_ID           — 試算表 ID

執行順序 / Execution order:
    1. analytics_events
    2. announcements
    3. admin_accounts
    4. feedback
    5. shared_items
    6. user_sync
    7. app_config
"""
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone

# 加入 backend 目錄到路徑
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import asyncpg


def _parse_dt(val: str) -> datetime | None:
    if not val or not val.strip():
        return None
    try:
        return datetime.fromisoformat(val.strip().replace("Z", "+00:00"))
    except Exception:
        return None


def _build_sheets_service():
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    info = json.loads(raw_json)
    creds = Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _get_rows(service, sheets_id: str, range_: str) -> list[list[str]]:
    result = service.spreadsheets().values().get(
        spreadsheetId=sheets_id, range=range_
    ).execute()
    return result.get("values", [])


async def migrate_analytics(conn, service, sheets_id: str) -> int:
    rows = _get_rows(service, sheets_id, "analytics_events!A2:E")
    count = 0
    for row in rows:
        row = row + [""] * (5 - len(row))
        ts = _parse_dt(row[0]) or datetime.now(timezone.utc)
        device_hash = row[1].strip() or "unknown"
        event_type = row[2].strip()
        page = row[3].strip()
        extra_str = row[4].strip()
        if not event_type:
            continue
        try:
            extra = json.loads(extra_str) if extra_str else {}
        except Exception:
            extra = {}
        await conn.execute("""
            INSERT INTO analytics_events (ts, device_id_hash, event_type, page, extra)
            VALUES ($1, $2, $3, $4, $5)
        """, ts, device_hash, event_type, page, json.dumps(extra))
        count += 1
    return count


async def migrate_announcements(conn, service, sheets_id: str) -> int:
    rows = _get_rows(service, sheets_id, "announcements!A2:J")
    count = 0
    for row in rows:
        row = row + [""] * (10 - len(row))
        ann_id = row[0].strip()
        title = row[1].strip()
        if not title:
            continue
        try:
            ann_uuid = uuid.UUID(ann_id) if ann_id else uuid.uuid4()
        except ValueError:
            ann_uuid = uuid.uuid4()
        try:
            version = int(row[9].strip()) if row[9].strip() else 1
        except ValueError:
            version = 1
        await conn.execute("""
            INSERT INTO announcements (id, title, body, type, target, published_at, expires_at, link_url, link_label, version)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        """,
            ann_uuid, title, row[2].strip(), row[3].strip() or "info",
            row[4].strip() or "all", _parse_dt(row[5]), _parse_dt(row[6]),
            row[7].strip() or None, row[8].strip() or None, version,
        )
        count += 1
    return count


async def migrate_admin_accounts(conn, service, sheets_id: str) -> int:
    rows = _get_rows(service, sheets_id, "admin_accounts!A2:D")
    count = 0
    for row in rows:
        row = row + [""] * (4 - len(row))
        username = row[0].strip()
        bcrypt_hash = row[1].strip()
        if not username or not bcrypt_hash:
            continue
        is_active_str = row[3].strip().lower()
        is_active = is_active_str not in ("false", "0", "no", "inactive")
        await conn.execute("""
            INSERT INTO admin_accounts (username, bcrypt_hash, created_at, is_active)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) DO NOTHING
        """,
            username, bcrypt_hash,
            _parse_dt(row[2]) or datetime.now(timezone.utc), is_active,
        )
        count += 1
    return count


async def migrate_feedback(conn, service, sheets_id: str) -> int:
    rows = _get_rows(service, sheets_id, "feedback!A2:I")
    count = 0
    for row in rows:
        row = row + [""] * (9 - len(row))
        fb_id = row[0].strip()
        content = row[3].strip()
        if not fb_id or not content:
            continue
        try:
            fb_uuid = uuid.UUID(fb_id)
        except ValueError:
            fb_uuid = uuid.uuid4()
        await conn.execute("""
            INSERT INTO feedback (id, submitted_at, category, content, contact, device_id_hash, status, admin_reply, replied_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        """,
            fb_uuid,
            _parse_dt(row[1]) or datetime.now(timezone.utc),
            row[2].strip() or "",
            content,
            row[4].strip() or None,
            row[5].strip() or "",
            row[6].strip() or "pending",
            row[7].strip() or None,
            _parse_dt(row[8]),
        )
        count += 1
    return count


async def migrate_shared_items(conn, service, sheets_id: str) -> int:
    rows = _get_rows(service, sheets_id, "shared_items!A2:H")
    count = 0
    for row in rows:
        row = row + [""] * (8 - len(row))
        code = row[0].strip()
        title = row[1].strip()
        if not code or not title:
            continue
        link_urls_raw = row[3].strip()
        try:
            link_urls = json.loads(link_urls_raw) if link_urls_raw.startswith("[") else ([link_urls_raw] if link_urls_raw else [])
        except Exception:
            link_urls = []
        is_deleted = row[6].strip().upper() == "TRUE"
        await conn.execute("""
            INSERT INTO shared_items (code, title, body, link_urls, device_id_hash, created_at, is_deleted, password_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (code) DO NOTHING
        """,
            code, title, row[2].strip() or None,
            json.dumps(link_urls), row[4].strip() or "",
            _parse_dt(row[5]) or datetime.now(timezone.utc),
            is_deleted, row[7].strip() or None,
        )
        count += 1
    return count


async def migrate_user_sync(conn, service, sheets_id: str) -> int:
    rows = _get_rows(service, sheets_id, "user_sync!A2:D")
    count = 0
    for row in rows:
        row = row + [""] * (4 - len(row))
        student_hash = row[0].strip()
        if not student_hash:
            continue
        try:
            tasks = json.loads(row[1]) if row[1].strip() else []
        except Exception:
            tasks = []
        try:
            shares = json.loads(row[2]) if row[2].strip() else []
        except Exception:
            shares = []
        await conn.execute("""
            INSERT INTO user_sync (student_id_hash, tasks_json, shares_json, updated_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (student_id_hash) DO NOTHING
        """,
            student_hash, json.dumps(tasks), json.dumps(shares),
            _parse_dt(row[3]) or datetime.now(timezone.utc),
        )
        count += 1
    return count


async def migrate_app_config(conn, service, sheets_id: str) -> int:
    rows = _get_rows(service, sheets_id, "app_config!A2:B")
    count = 0
    for row in rows:
        if len(row) < 2 or not row[0].strip():
            continue
        await conn.execute("""
            INSERT INTO app_config (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """, row[0].strip(), row[1].strip())
        count += 1
    return count


async def migrate_push_subscriptions(conn, service, sheets_id: str) -> int:
    rows = _get_rows(service, sheets_id, "push_subscriptions!A2:E")
    count = 0
    for row in rows:
        row = row + [""] * (5 - len(row))
        device_id = row[0].strip()
        endpoint = row[1].strip()
        p256dh = row[2].strip()
        auth = row[3].strip()
        if not endpoint or not p256dh or not auth:
            continue
        await conn.execute("""
            INSERT INTO push_subscriptions (endpoint, device_id, p256dh, auth, subscribed_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (endpoint) DO NOTHING
        """,
            endpoint, device_id, p256dh, auth,
            _parse_dt(row[4]) or datetime.now(timezone.utc),
        )
        count += 1
    return count


async def main():
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    sheets_id = os.getenv("GOOGLE_SHEETS_ID", "")
    if not sheets_id:
        print("ERROR: GOOGLE_SHEETS_ID not set")
        sys.exit(1)

    # SSL 模式：預設 "require"；本機測試可設 PG_SSL_MODE=disable
    ssl_env = os.getenv("PG_SSL_MODE", "require").strip().lower()
    conn_ssl: str | None = None if ssl_env in ("", "disable", "disabled", "false", "0") else ssl_env

    print("Connecting to PostgreSQL...")
    conn = await asyncpg.connect(db_url, ssl=conn_ssl)

    print("Building Google Sheets service...")
    service = _build_sheets_service()

    tasks = [
        ("analytics_events",   migrate_analytics),
        ("announcements",      migrate_announcements),
        ("admin_accounts",     migrate_admin_accounts),
        ("feedback",           migrate_feedback),
        ("shared_items",       migrate_shared_items),
        ("user_sync",          migrate_user_sync),
        ("app_config",         migrate_app_config),
        ("push_subscriptions", migrate_push_subscriptions),
    ]

    for name, fn in tasks:
        print(f"  Migrating {name}...", end=" ", flush=True)
        try:
            n = await fn(conn, service, sheets_id)
            print(f"{n} rows")
        except Exception as exc:
            print(f"FAILED: {exc}")

    await conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(main())
