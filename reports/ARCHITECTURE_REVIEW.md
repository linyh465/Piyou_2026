# 披呦 (Piyou) — 架構審查報告 / Architecture Review Report

> 審查日期 / Review Date: 2026-03-16
> 分支 / Branch: `claude/review-project-architecture-EFn7Z`

---

## 摘要 / Executive Summary

披呦整體架構設計清晰，前後端職責分離、安全意識強（零日誌策略、Rate Limiter、JWT 認證），且程式碼風格一致。以下條列出各層次的**具體改善建議**，依嚴重程度排序。

The overall architecture of Piyou is well-structured with clear separation of concerns, strong security awareness (zero-log policy, rate limiter, JWT auth), and consistent code style. Below are **specific improvement suggestions** ordered by severity.

---

## 嚴重 / Critical

### 1. 事件迴圈阻塞（Event Loop Blocking）
**位置**: `backend/app/routers/data.py:115`

```python
# 現況 — 直接呼叫阻塞式 I/O，會凍結整個 FastAPI 事件迴圈
scraper.login(creds[0], creds[1])

# 建議修正 — 同 auth.py 的做法，包入 asyncio.to_thread
await asyncio.to_thread(scraper.login, creds[0], creds[1])
```

`_get_authenticated_scraper` 函數是同步函數並被 `async def` 路由直接呼叫，其中的 `scraper.login()` 包含網路請求與 `time.sleep`。這在 scraper session 過期需要重新登入時，**會完全阻塞事件迴圈**，影響所有並發請求。`auth.py:169` 已正確使用 `asyncio.to_thread`，`data.py:115` 應保持一致。

**建議**：將 `_get_authenticated_scraper` 改為 `async def` 並使用 `await asyncio.to_thread`。

---

### 2. SSL 驗證停用（SSL Verification Disabled）
**位置**: `backend/app/services/scraper.py:46`

```python
self.session.verify = False  # 停用 SSL 驗證
```

雖然校務系統 SSL 憑證缺少 Subject Key Identifier 是外部限制，但完全停用 SSL 驗證使系統暴露於 MITM 攻擊風險。

**建議方案**（依優先序）：
1. 向學校 IT 申請修正憑證（根本解法）
2. 下載並固定學校憑證，以 `verify="/path/to/school_cert.pem"` 取代 `verify=False`（Certificate Pinning）
3. 若以上皆不可行，建議在程式碼中新增顯眼的警告說明，並限制此設定僅在特定環境有效

---

## 高優先 / High Priority

### 3. 磁碟快取包含學號（Disk Cache Contains Student ID）
**位置**: `backend/app/routers/data.py:56-57`

```python
def _get_cache_path(student_id: str, data_type: str) -> Path:
    safe_id = "".join(c for c in student_id if c.isalnum())
    return CACHE_DIR / f"{safe_id}_{data_type}.json"  # e.g. A12345678_timetable.json
```

快取檔名直接包含學號，在多使用者或共用主機環境中可能洩漏使用者資訊。

**建議**：使用學號的 SHA-256 Hash（取前 16 字元）作為檔名。

```python
import hashlib
def _get_cache_path(student_id: str, data_type: str) -> Path:
    hashed = hashlib.sha256(student_id.encode()).hexdigest()[:16]
    return CACHE_DIR / f"{hashed}_{data_type}.json"
```

---

### 4. 並發 Scraper 競態條件（Race Condition in Scraper Session）
**位置**: `backend/app/routers/data.py:93-120` / `backend/app/services/scraper_cache.py`

當多個請求同時發現 scraper session 過期，可能同時觸發多次對校務系統的登入請求，不僅浪費資源，也可能觸發校方的防爬機制。

**建議**：使用 `asyncio.Lock`（每學號一個）保護 `_get_authenticated_scraper`，確保同一時間只有一個登入請求進行。

```python
_scraper_locks: dict[str, asyncio.Lock] = {}

async def _get_authenticated_scraper(user: dict) -> SchoolScraper:
    student_id = user.get("sub", "")
    if student_id not in _scraper_locks:
        _scraper_locks[student_id] = asyncio.Lock()
    async with _scraper_locks[student_id]:
        cached = get_cached_scraper(student_id)
        if cached:
            return cached
        # ... 執行登入
```

---

### 5. 認證流程缺少 Refresh Token 機制
**位置**: `backend/app/routers/auth.py:57`

```python
JWT_EXPIRE_HOURS = 24
```

JWT 24 小時後過期，使用者必須重新輸入帳密觸發完整爬蟲登入流程。由於 `_credential_cache` 也有 24 小時 TTL，理論上可以靜默更新，但前端沒有對應的 refresh endpoint。

**建議**：新增 `POST /auth/refresh` 端點。當 JWT 剩餘有效期 < 2 小時且 `_credential_cache` 中仍有憑證時，簽發新 JWT，避免使用者無感中斷。

---

## 中優先 / Medium Priority

### 6. scraper.py 模組過大（Large Monolithic Scraper）
**位置**: `backend/app/services/scraper.py`（1,500+ 行）

整個校務系統爬蟲集中在單一檔案，包含登入、課表、成績、個人資訊等多種功能，難以維護與測試。

**建議**：依資料域拆分模組：
```
services/
  scraper/
    __init__.py        # SchoolScraper 主類，整合各 mixin
    auth.py            # 登入與 session 管理
    timetable.py       # 課表解析
    grades.py          # 成績解析
    profile.py         # 個人資訊
```

---

### 7. 前端 PageLoader 未使用 i18n
**位置**: `frontend/src/App.jsx:31`

```jsx
// 現況 — 硬編碼中文
<div>載入中…</div>

// 建議 — 使用 i18n
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('common');
<div>{t('loading')}</div>
```

專案已實作 10 種語言支援，但最先顯示的 Loading 文字未使用 i18n，對非中文語系使用者體驗不一致。

---

### 8. 磁碟快取未加密（Plaintext Disk Cache）
**位置**: `backend/app/routers/data.py:82-91`

課表、成績等個人資料以明文 JSON 寫入磁碟快取。雖然專案已說明「不在伺服器端快取課表/成績」，但快取功能確實存在並被呼叫。

**建議**：若要保留磁碟快取，使用對稱加密（如 `cryptography.fernet`）加密後儲存，並在讀取時解密；或限制磁碟快取僅用於不含個人資訊的公開資料（如公車路線）。

---

### 9. `schemas.py` 中 `rank` 與 `class_rank` 語義重疊
**位置**: `backend/app/models/schemas.py:67-69`

```python
rank: Optional[str]       # "排名 / Class rank (e.g. '5/60')"
class_rank: Optional[str] # "班排名 / Class rank (e.g. '5/60')"
```

兩個欄位的 description 相同（都是 "Class rank"），容易造成混淆。

**建議**：釐清欄位語義，例如 `overall_rank`（班排名）與 `dept_rank`（系排名），或直接移除 `rank` 並統一使用 `class_rank`。

---

### 10. 速率限制不考慮反向代理（Rate Limiter Proxy Awareness）
**位置**: `backend/app/middleware/security.py:122`

```python
client_ip = request.client.host if request.client else "unknown"
```

在 Railway 等有反向代理的環境，`request.client.host` 可能是代理 IP，導致所有使用者共用同一個速率限制 bucket，或速率限制完全失效。

**建議**：參考 `auth.py:37-40` 中已實作的 `_get_client_ip` 函數（優先讀取 `X-Forwarded-For`），統一套用到 `RateLimitMiddleware`。

```python
forwarded = request.headers.get("x-forwarded-for")
client_ip = forwarded.split(",")[0].strip() if forwarded else (
    request.client.host if request.client else "unknown"
)
```

---

## 低優先 / Low Priority

### 11. 測試覆蓋率不足（Test Coverage Gaps）

目前觀察到缺乏以下測試：
- 中介層測試：`CredentialFilter`、`RateLimitMiddleware`、`SyncCooldownTracker`
- Auth 整合測試：完整登入流程 → JWT 解碼 → 資料端點存取
- 前端：`apiClient` 攔截器行為測試

**建議**：優先新增 `SyncCooldownTracker` 的單元測試（邊界條件：cooldown 過期時間、error lock 觸發）。

---

### 12. 結構化日誌（Structured Logging）

現有日誌為純文字字串，在生產環境難以追蹤跨請求的問題。

**建議**：加入請求 ID（Request ID）追蹤，例如：

```python
# 在中介層生成 request_id 並傳遞
import uuid
request_id = str(uuid.uuid4())[:8]
logger.info("Login successful", extra={"request_id": request_id, "event": "auth.login"})
```

---

### 13. Docker 健康檢查（Docker Health Check）
**位置**: `backend/Dockerfile`、`docker-compose.yml`

現有 `docker-compose.yml` 未設定 `healthcheck`，僅靠 `/health` 端點但不會自動重啟。

**建議**：在 `docker-compose.yml` 新增：
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

---

## 優點彙整 / Strengths Summary

以下是架構中值得保留的優良設計：

| 項目 | 說明 |
|------|------|
| **零日誌策略** | `CredentialFilter` 確保敏感資訊不進入日誌，設計嚴謹 |
| **Scraper Session 快取** | `auth.py` 登入後快取 session，避免 `data.py` 重複登入，減輕校方伺服器負擔 |
| **LRU 式快取淘汰** | `_credential_cache` 與 `_scraper_cache` 均有最大容量限制與過期清理 |
| **asyncio.to_thread** | `auth.py:169` 正確將阻塞式爬蟲操作移出事件迴圈 |
| **Pydantic 模型驗證** | `LoginRequest` 使用 `pattern` 約束學號格式，防止注入 |
| **CORS 自動偵測** | Railway 環境自動允許 `*.railway.app` 來源，減少部署摩擦 |
| **生產環境關閉 API Docs** | `docs_url=None if _is_production` 避免暴露 API schema |
| **PWA 離線支援** | Service Worker 快取策略（NetworkFirst for API, CacheFirst for assets）設計合理 |
| **多語系支援** | i18next 支援 10 種語言，架構完善 |
| **前端重試機制** | `retryWithBackoff` 為網路請求提供韌性 |

---

## 改善優先序總覽 / Priority Summary

| 優先序 | 項目 | 影響 |
|--------|------|------|
| 🔴 Critical | 事件迴圈阻塞（data.py:115） | 生產環境請求凍結 |
| 🔴 Critical | SSL 驗證停用 | MITM 安全風險 |
| 🟠 High | 磁碟快取含學號 | 隱私洩漏 |
| 🟠 High | Scraper 競態條件 | 重複登入、資源浪費 |
| 🟠 High | 缺少 Refresh Token | 使用者體驗中斷 |
| 🟡 Medium | scraper.py 過大 | 維護性降低 |
| 🟡 Medium | PageLoader 未用 i18n | 多語系體驗不一致 |
| 🟡 Medium | 磁碟快取明文 | 個資保護 |
| 🟡 Medium | rank 欄位語義重疊 | API 合約不清晰 |
| 🟡 Medium | Rate Limiter Proxy | 限流可能失效 |
| 🟢 Low | 測試覆蓋率 | 程式碼品質 |
| 🟢 Low | 結構化日誌 | 可觀測性 |
| 🟢 Low | Docker 健康檢查 | 運維穩定性 |
