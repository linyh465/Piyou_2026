# 公告系統 + 意見回饋 + 同步紀錄 實作計畫

> 建立日期：2026-03-18
> 狀態：已實作完成

---

## 功能概覽

| 功能 | 說明 |
|---|---|
| **公告發布系統** | 管理員在 Google Sheets 填公告 → 學生開啟 App 時彈窗 + 右上角鈴鐺 + 本地推播 |
| **意見回饋系統** | 學生匿名送出回饋，管理員在 Sheets 回覆，學生可用 ID 查詢 |
| **同步紀錄** | 每次資料同步（課表/成績/圖書館/任務）自動寫入 `sync_logs` 工作表 |
| **Sheets 自動初始化** | App 啟動時自動建立所需工作表與標題列 |

---

## Google Sheets 試算表結構

同一份試算表（`GOOGLE_SHEETS_ID`），新增 4 個工作表：

### `announcements`
| 欄 | A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|---|
| 欄位 | id | title | body | type | target | published_at | expires_at | link_url | link_label |

- `type`：`info` / `warning` / `urgent`
- `published_at` 空白 = 草稿；填 ISO 8601 = 發布
- `expires_at` 空白 = 永不過期

### `feedback`
| 欄 | A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|---|
| 欄位 | id | submitted_at | category | content | contact | device_id | status | admin_reply | replied_at |

- `category`：`bug` / `feature` / `question` / `other`
- `status`：`pending`（初始）/ `replied`（管理員手動改）
- 管理員在 `admin_reply` 欄填回覆，`replied_at` 填時間，`status` 改 `replied`

### `sync_logs`
| 欄 | A | B | C | D | E |
|---|---|---|---|---|---|
| 欄位 | synced_at | sync_type | student_id_hash | status | duration_ms |

- `student_id_hash`：SHA-256 前 8 字元（不可反推學號）
- `sync_type`：`timetable` / `grades` / `library` / `tasks`

### `push_subscriptions`（Phase 2 預留）
| 欄 | A | B | C | D | E |
|---|---|---|---|---|---|
| 欄位 | device_id | endpoint | p256dh | auth | subscribed_at |

---

## 後端新增檔案

| 檔案 | 功能 |
|---|---|
| `backend/app/services/storage/sheets_setup.py` | FastAPI lifespan 啟動時自動建立工作表與標題列 |
| `backend/app/services/storage/sheets_notify.py` | 公告讀取（5 分鐘快取）、feedback 讀寫（2 分鐘快取）|
| `backend/app/services/storage/sheets_synclog.py` | 非同步 append sync_logs，失敗只記 warning |
| `backend/app/routers/notify.py` | 3 個公開端點 + 管理員 invalidate 端點 |
| `backend/tests/test_notify.py` | pytest CI 測試 |

## 後端修改檔案

| 檔案 | 修改內容 |
|---|---|
| `backend/app/main.py` | lifespan 加 `ensure_sheets_exist()`，掛載 notify router |
| `backend/app/models/schemas.py` | 新增 Announcement、AnnouncementsResponse、FeedbackRequest、FeedbackResponse |
| `backend/app/routers/data.py` | timetable/grades/library/tasks 端點成功後加 `asyncio.create_task(log_sync(...))` |

---

## 後端 API 端點

```
GET  /api/v1/notify/announcements                  公告列表（公開）
POST /api/v1/notify/feedback                        送出回饋（公開）
GET  /api/v1/notify/feedback/{id}                  查詢回饋（公開）
POST /api/v1/notify/admin/announcements/invalidate  清除快取（需 X-Admin-Token header）
```

### 管理員認證
環境變數 `ADMIN_TOKEN`，透過 `X-Admin-Token` header 傳入。

---

## 前端新增檔案

| 檔案 | 功能 |
|---|---|
| `frontend/src/stores/notifyStore.js` | 公告狀態、未讀追蹤、本地推播、feedback 送出/查詢 |
| `frontend/src/components/AnnouncementModal.jsx` | App 啟動後若有未讀公告顯示彈窗（每 session 一次）|
| `frontend/src/components/NotificationPanel.jsx` | 右上角鈴鐺按鈕（fixed）+ 下拉公告列表 |
| `frontend/src/components/FeedbackModal.jsx` | 匿名回饋表單 + 查詢回覆 |
| `frontend/src/test/notifyStore.test.js` | Vitest CI 測試 |

## 前端修改檔案

| 檔案 | 修改內容 |
|---|---|
| `frontend/src/main.jsx` | 掛載 `<AnnouncementModal />` |
| `frontend/src/components/Layout.jsx` | 注入 `<NotificationPanel />` 和 `<FeedbackModal />`（全頁固定）|
| `frontend/src/pages/Settings.jsx` | 新增「校園公告通知」開關，「關於」區段加意見回饋入口 |
| `frontend/src/components/Icons.jsx` | 新增 `IconBell` |

---

## 快取策略

| 資料 | 後端快取 | 前端快取 |
|---|---|---|
| 公告列表 | 模組層級記憶體 5 分鐘 | localStorage 5 分鐘 |
| Feedback 查詢 | 模組層級記憶體 2 分鐘 | 無 |
| Feedback 寫入 | 無（即時寫入）| 無 |
| Sync logs | 無（即時 append）| 無 |

---

## 隱私原則

- **不儲存學號**：feedback 匿名，只用 device_id 防濫用
- **不儲存 IP**：由 RateLimitMiddleware 處理但不記錄
- **學號匿名化**：sync_logs 只存 SHA-256 前 8 字元
- **已讀狀態**：只存本裝置 localStorage，不上傳伺服器

---

## 管理員工作流程

**發布公告**：在 `announcements` 工作表新增列，填入 `title`、`body`、`type`、`published_at` 即發布。

**回覆意見**：在 `feedback` 工作表找到對應列，填入 `admin_reply`、`replied_at`，將 `status` 改為 `replied`。

**立即更新快取**：執行 `POST /api/v1/notify/admin/announcements/invalidate`（加 `X-Admin-Token` header），讓前端立即看到最新公告。

---

## PWA 推播

### Phase 1（已實作）
`notifyStore.triggerLocalNotification()` → `serviceWorker.ready.showNotification()`
無需 VAPID 金鑰，有 `urgent` 公告 + 使用者已授權時自動觸發。

### Phase 2（未來）
- 後端安裝 `pywebpush`，生成 VAPID 金鑰
- Vite PWA 從 `generateSW` 改為 `injectManifest`，自訂 SW 處理 `push` 事件
- `push_subscriptions` 工作表已預留 schema

---

## 未來擴充方向

| 功能 | 預留機制 |
|---|---|
| 分系所公告 | `target` 欄（目前 `all`）|
| 活動類公告 | `type` 新增 `event` |
| Web Push | `push_subscriptions` 工作表已預留 |
| 管理員 UI | 目前直接操作 Sheets；未來可加 `/admin` 路由 |
| 回饋投票 | `feedback` 加 `upvotes` 欄 |
| 學校官網公告爬蟲 | 自動寫入 `announcements` Sheet |
| 同步分析 | `sync_logs` 可用 Sheets 圖表分析同步頻率 |
