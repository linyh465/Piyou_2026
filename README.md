# 🐾 披呦 Piyou

> 靜宜大學學生的校園整合行動應用程式  
> An integrated campus PWA for Providence University students

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📖 目錄 / Table of Contents

- [功能介紹](#-功能介紹--features)
- [技術架構](#-技術架構--tech-stack)
- [安全機制](#-安全機制--security)
- [快速開始](#-快速開始--quick-start)
- [環境變數](#-環境變數--environment-variables)
- [目錄結構](#-目錄結構--project-structure)
- [部署](#-部署--deployment)
- [開發指令](#-開發指令--development-commands)
- [貢獻指南](#-貢獻指南--contributing)

---

## ✨ 功能介紹 / Features

| 功能 | 說明 |
|------|------|
| 🏠 **首頁儀表板** | 個人化課表、成績、任務摘要一覽 |
| 📅 **課表** | 自動從校務系統同步學期課表 |
| 📊 **成績** | 即時查詢學期成績 |
| ✅ **任務管理** | 本機 SQLite 儲存，跨裝置雲端同步 |
| 🚌 **交通資訊** | 即時公車到站資訊（TDX API） |
| 📚 **圖書館** | 個人借閱紀錄查詢 |
| 🔗 **共享平台** | 建立密碼保護的分享連結（筆記、資源） |
| ⚙️ **設定** | 多主題、語言切換（繁中／英）、PWA 更新 |
| 🛡️ **管理員面板** | 資安告警、維護模式、資料清除 |
| 📱 **PWA** | 可安裝至主畫面、離線存取支援 |

---

## 🏗 技術架構 / Tech Stack

### 後端 / Backend
- **[FastAPI](https://fastapi.tiangolo.com/)** — 非同步 Python Web 框架
- **[Uvicorn](https://www.uvicorn.org/)** — ASGI 伺服器
- **[Pydantic v2](https://docs.pydantic.dev/)** — 資料驗證
- **[PyJWT](https://pyjwt.readthedocs.io/)** — JWT 認證
- **[bcrypt](https://pypi.org/project/bcrypt/)** — 密碼雜湊
- **[Google Sheets API](https://developers.google.com/sheets/api)** — 雲端資料儲存後端
- **[TDX API](https://tdx.transportdata.tw/)** — 交通資料來源

### 前端 / Frontend
- **[React 19](https://react.dev/)** + **[Vite 7](https://vitejs.dev/)** — 前端框架與建置工具
- **[Tailwind CSS 4](https://tailwindcss.com/)** — 樣式框架
- **[Zustand](https://zustand-demo.pmnd.rs/)** — 輕量狀態管理
- **[React Router 7](https://reactrouter.com/)** — 客戶端路由
- **[react-i18next](https://react.i18next.com/)** — 多語言（繁中／英）
- **[sql.js](https://sql.js.org/)** — 瀏覽器內 SQLite（本機任務儲存）
- **[vite-plugin-pwa](https://vite-pwa-org.netlify.app/)** — PWA 支援（Service Worker）

### 部署 / Deployment
- **[Docker](https://www.docker.com/) + Docker Compose** — 容器化
- **[Railway](https://railway.app/)** — 雲端部署平台

---

## 🛡 安全機制 / Security

披呦後端內建多層資安防護：

| 層級 | 機制 | 說明 |
|------|------|------|
| 傳輸層 | **HTTPS 強制重導向** | 生產環境自動跳轉至 HTTPS |
| 請求層 | **速率限制** | 每 IP 60 次/分鐘，超過回傳 429 |
| 請求層 | **WAF 過濾** | 阻擋 SQL Injection、XSS、路徑穿越等攻擊字串 |
| 請求層 | **機器人封鎖** | 依 User-Agent 過濾已知爬蟲 |
| 請求層 | **IP 封鎖** | 可設定黑名單 IP |
| 回應層 | **安全標頭** | `Content-Security-Policy`、`X-Frame-Options`、`X-Content-Type-Options` 等 |
| 認證層 | **JWT Token** | HS256 簽名，含過期時間 |
| 認證層 | **管理員登入鎖定** | 3 次失敗後鎖定 15 分鐘 |
| 認證層 | **常數時間比對** | 使用 `hmac.compare_digest()` 防時序攻擊 |
| 資料層 | **零日誌策略** | 日誌過濾器阻止帳密寫入任何日誌 |
| 資料層 | **URL 白名單驗證** | 所有連結欄位僅允許 `http://` 或 `https://` |
| 資料層 | **裝置 ID 驗證** | 共享操作驗證 `X-Device-Id` header 與 payload 一致 |
| 資料層 | **路徑參數正則驗證** | feedback ID 等路徑參數以 `^[A-Za-z0-9_-]+$` 防注入 |
| CORS | **明確白名單** | methods/headers 均指定白名單，不使用萬用字元 |

> ⚠️ **重要**：部署前請務必更換 `.env` 中的 `JWT_SECRET` 為強隨機密鑰。

---

## 🚀 快速開始 / Quick Start

### 前置需求 / Prerequisites

- **Docker** & **Docker Compose**（推薦）
- 或：Python 3.11+、Node.js 18+

### 使用 Docker（最簡單）/ Using Docker (Recommended)

```bash
# 1. 複製環境變數範本
cp .env.example backend/.env

# 2. 編輯 backend/.env，填入必要的密鑰與 API 憑證
#    Edit backend/.env with your secrets and API credentials
nano backend/.env

# 3. 啟動（前後端一起）
docker compose up --build

# 4. 開啟瀏覽器
#    Frontend: http://localhost:80
#    Backend API: http://localhost:8000
#    API Docs: http://localhost:8000/docs  (僅開發模式)
```

### 本機開發 / Local Development

**後端 / Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env        # 填入環境變數
uvicorn app.main:app --reload --port 8000
```

**前端 / Frontend:**
```bash
cd frontend
npm install
npm run dev
# 開啟 http://localhost:5173
```

---

## 🔧 環境變數 / Environment Variables

複製 `.env.example` 為 `backend/.env` 並填入以下設定：

| 變數 | 說明 | 必填 |
|------|------|------|
| `JWT_SECRET` | JWT 簽名密鑰（請使用強隨機字串） | ✅ |
| `SCHOOL_PORTAL_URL` | 校務系統 URL | ✅ |
| `TDX_CLIENT_ID` | TDX API Client ID | ✅ |
| `TDX_CLIENT_SECRET` | TDX API Client Secret | ✅ |
| `CORS_ORIGINS` | 允許的 CORS 來源（逗號分隔） | ✅ |
| `BUG_REPORT_EMAIL` | 錯誤回報收件信箱 | ➖ |
| `SMTP_HOST` | SMTP 伺服器位址 | ➖ |
| `SMTP_PORT` | SMTP 埠號（預設 587） | ➖ |
| `SMTP_USER` | SMTP 帳號 | ➖ |
| `SMTP_PASSWORD` | SMTP 密碼（Gmail 建議用應用程式密碼） | ➖ |
| `ENVIRONMENT` | 設為 `production` 啟用生產模式 | ➖ |

> 詳細說明請參考 [`.env.example`](.env.example)

---

## 📂 目錄結構 / Project Structure

```
Piyou_2026/
├── backend/                  # FastAPI 後端
│   ├── app/
│   │   ├── main.py           # 應用入口、中介層、路由註冊
│   │   ├── middleware/
│   │   │   └── security.py   # 安全中介層（HTTPS、Rate Limit、WAF 等）
│   │   ├── models/
│   │   │   └── schemas.py    # Pydantic 資料模型
│   │   ├── routers/          # API 路由
│   │   │   ├── auth.py       # 認證（登入／登出／JWT）
│   │   │   ├── data.py       # 資料（課表、成績、圖書館）
│   │   │   ├── share.py      # 共享平台
│   │   │   ├── notify.py     # 公告通知、管理員面板
│   │   │   ├── analytics.py  # 使用分析
│   │   │   └── error_report.py # 錯誤回報
│   │   └── services/         # 業務邏輯
│   │       ├── scraper.py        # 校務系統爬蟲
│   │       ├── library_scraper.py # 圖書館爬蟲
│   │       ├── scraper_cache.py  # 會話快取（30 分 TTL）
│   │       ├── demo.py           # 展示帳號
│   │       ├── tdx.py            # 交通 TDX API
│   │       └── storage/          # Google Sheets 儲存層
│   ├── tests/                # pytest 測試
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                 # React + Vite 前端
│   ├── src/
│   │   ├── App.jsx           # 路由與應用入口
│   │   ├── pages/            # 各功能頁面
│   │   ├── components/       # 共用元件
│   │   ├── stores/           # Zustand 狀態管理
│   │   ├── services/         # API 呼叫、本機 DB、PWA
│   │   ├── locales/          # i18n 翻譯檔（zh-TW / en）
│   │   └── sw.js             # Service Worker
│   ├── public/
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml        # 一鍵啟動前後端
├── .env.example              # 環境變數範本
├── .gitignore
└── CHANGELOG.md
```

---

## 🚢 部署 / Deployment

### Railway 部署

1. 將前後端分別建立兩個 Railway Service
2. 後端設定環境變數（參考 [環境變數](#-環境變數--environment-variables)）
3. 後端會自動偵測 `RAILWAY_PUBLIC_DOMAIN`，套用 Railway CORS 規則
4. 設定 `ENVIRONMENT=production` 啟用生產安全模式（隱藏 API docs、強制 HTTPS）

### Docker Compose 生產部署

```bash
# 確認 backend/.env 已設定 ENVIRONMENT=production
docker compose up -d --build
```

---

## 💻 開發指令 / Development Commands

### 後端 / Backend

```bash
cd backend
# 執行測試
pytest

# 執行 linter (若已安裝 ruff)
ruff check app/
```

### 前端 / Frontend

```bash
cd frontend
npm run dev        # 開發伺服器
npm run build      # 生產建置
npm run preview    # 預覽建置結果
npm run lint       # ESLint 檢查
npm run test       # Vitest 測試
```

---

## 🤝 貢獻指南 / Contributing

1. Fork 本專案
2. 建立功能分支：`git checkout -b feat/your-feature`
3. 提交變更：`git commit -m 'feat: add some feature'`
4. 推送分支：`git push origin feat/your-feature`
5. 開啟 Pull Request

### 安全回報 / Security Reporting

如發現安全漏洞，請**不要**開公開 Issue，請直接聯絡維護者。  
If you discover a security vulnerability, please do **not** open a public issue. Contact the maintainer directly.

---

## 📜 授權 / License

本專案以 [MIT License](LICENSE) 授權。  
This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  Made with 🐾 by the Piyou Team<br>
  <sub>靜宜大學 Providence University</sub>
</div>
