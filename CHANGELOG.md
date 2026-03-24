# Changelog

本專案所有重要變更皆記錄於此，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。
All notable changes to this project are documented here, following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [2026-03-24] — 資安稽核修復 + 資安面板

### Added
- **管理員資安面板**（`Admin.jsx` 新分頁「資安面板」）
  - AI 規則式異常告警：每 60 秒自動偵測，涵蓋錯誤爆增、同步失敗率、異常流量、錯誤事件比例四項規則
  - 緊急維護模式：一鍵開啟/關閉，前端啟動時檢查並顯示維護畫面
  - 資料清除：可分別清除 analytics / 共享平台 / 跨裝置同步 / 意見回饋，雙重確認防誤操作
- **後端 Admin API** (`notify.py`)
  - `GET /notify/admin/security/anomalies` — AI 異常告警清單
  - `POST /notify/admin/maintenance` — 維護模式切換（寫入 app_config）
  - `DELETE /notify/admin/data/{type}` — 清除指定資料（analytics/shares/usersync/feedback）
- **維護模式前端檢查** (`App.jsx`)：啟動時呼叫 `GET /notify/config`，若 `maintenance_mode=true` 則顯示維護畫面，請求失敗時 fallback 正常顯示
- **`GET /notify/config`** 新增回傳 `maintenance_mode`、`maintenance_message` 欄位
- **Storage 清除函式**
  - `sheets_notify.py`: `clear_all_feedback()`
  - `sheets_share.py`: `clear_all_shares()`
  - `sheets_usersync.py`: `clear_all_sync_data()`
  - `sheets_analytics.py`: `clear_all_events()`、`get_anomalies()`
- **任務頁 / 共享頁 手動同步按鈕**：可直接觸發上傳 + 下載合併，共享頁整合至重整流程
- **`SyncToast`** 同步完成 Toast 通知

### Fixed
#### 資安（Security Audit）
- **C1** `main.py`：CORS 從萬用字元改為明確 methods/headers 白名單
- **C2** `secureStorage.js`：移除用固定 key XOR 的偽加密，改存純 JSON（sessionStorage sandbox 已足夠）
- **C3** `share.py`：`create/update/delete_share` 驗證 payload.device_id 須與 `X-Device-Id` header 一致，防偽造
- **H1** `auth.py`：`logout` 端點（`POST /auth/logout`）清除伺服器端 credential cache
- **H2** `notify.py`：管理員登入新增每帳號失敗計數，3 次失敗鎖定 15 分鐘
- **H3** `userSyncService.js`：模組層級 `_uploadInProgress` flag，防止並發上傳 race condition
- **H4** `auth.py`：credential cache 解碼失敗時主動清除損壞條目
- **M1** `localDb.js`：任務合併改用 `Date.getTime()` 數值比較，避免字串排序錯誤
- **M2** `authStore.js`：登出時呼叫 `/auth/logout` 清除伺服器快取（fire-and-forget）
- **M3** `notify.py`：feedback ID 路徑參數加 regex 驗證 `^[A-Za-z0-9_-]+$`，防路徑注入
- **M4** `userSyncService.js`：503 狀態靜默忽略（本地開發），其他錯誤才 console.warn
- **M5** `ErrorBoundary.jsx`：錯誤回報失敗改為 `console.warn` 而非完全靜默
- **L1** `apiClient.js`：`_DEVICE_ID` 改為模組層級 IIFE 常數，避免每次請求讀取 localStorage
- **L2** `auth.py`：credential cache 上限從 200 降至 50
- **L3** `authStore.js`：移除已失效的 secureStorage 遺留程式碼

#### 同步邏輯（Sync）
- 已刪除的共享訂閱被跨裝置同步還原：`mergeShares` 現在同時過濾本地與遠端的 tombstone codes
- 「移除此則」缺少 `markShareRemoved` 呼叫導致 tombstone 未設定
- 任務刪除後同步問題：`mergeWithServer` 時間戳比較改用數值，修復舊資料字串排序錯誤

#### PWA 更新
- **根本原因修復** `sw.js`：補上 `SKIP_WAITING` message event listener（`injectManifest` 策略不自動注入），`postMessage` 不再被靜默忽略
- `pwaUpdate.js`：新增 3 秒 setTimeout fallback，解決 Android Chrome `controllerchange` 未觸發問題
- `Settings.jsx`：新增 `'updating'` 狀態，顯示「正在更新…」避免按鈕停在「檢查中…」

### Changed
- 管理員 tabs 新增「資安面板」（紅色高亮），現有 tabs 順序不變
- `GET /notify/config` 回傳欄位新增 `maintenance_mode`、`maintenance_message`

---

## 舊版變更（歷史 commits 摘要）

| Commit | 說明 |
|--------|------|
| `d5e7f1e` | feat(feedback): 意見回饋加入聯絡方式驗證機制 |
| `dfce563` | fix(share): 密碼驗證後正確顯示 body/links |
| `5127af9` | fix(modal): 修復 TDZ crash（btn styles 移至 early return 之前） |
| `c21f9f2` | feat(analytics): 新增公車取得、通知彈窗、按鈕點擊追蹤 |
| `895a13d` | fix(pwa): checkForUpdate 在 SW 更新時可靠地重新載入 |
| `784d299` | fix(test): 修復 2 個 CI 測試失敗（startOf priority、greeting regex） |
| `bfa61e9` | fix(lint): 移除未使用的解構變數 |
