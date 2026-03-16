# 2026-03-16 Piyou 專案清理報告

**日期：** 2026-03-16
**執行者：** Claude Sonnet 4.6 (claude-sonnet-4-6)
**分支：** main

---

## 一、本次變更摘要

本次共進行三大項清理作業：

### 1. 刪除 GitHub Pages 及 Koyeb 相關部署檔案

| 檔案 | 原因 |
|------|------|
| `.github/workflows/deploy-pages.yml` | 已不使用 GitHub Pages 部署前端 |
| `.github/workflows/keepalive.yml` | 防封存 workflow 已無必要 |
| `backend/koyeb.yaml` | 改由其他方式管理 Koyeb 部署 |
| `frontend/dist/` | Build 產出物不應納入版本控制 |

> **保留：** `backend/railway.toml`、`frontend/railway.toml`（繼續使用 Railway）
> **保留：** `.github/workflows/ci.yml`（持續整合仍需運作）

---

### 2. 移除玩課雲（TronClass / WoW Class）功能

玩課雲功能為抓取學校 TronClass 作業平台資料，因功能封存故完整移除。

**完整刪除的專屬檔案：**

| 檔案 | 說明 |
|------|------|
| `backend/app/services/tronclass_scraper.py` | 玩課雲爬蟲服務（231 行） |
| `frontend/src/pages/WowClass.jsx` | 玩課雲前端頁面（304 行） |
| `frontend/src/stores/tronclassStore.js` | 玩課雲 Zustand 狀態管理（134 行） |
| `frontend/src/locales/*/wowClass.json` | 全語系玩課雲翻譯（共 10 個 JSON 檔） |

**共用檔案清理（移除玩課雲相關代碼，保留其他功能）：**

| 檔案 | 清理內容 |
|------|----------|
| `backend/app/routers/data.py` | 移除 `/tronclass` API endpoint、`_get_tronclass_scraper()`、`MOCK_TRONCLASS`、相關 import（共 91 行） |
| `backend/app/models/schemas.py` | 移除 `TronClassAssignment`、`TronClassResponse` Pydantic 模型（共 20 行） |
| `frontend/src/locales/zh-TW/nav.json` | 移除 `"wowClass"` 導覽項目 |
| `frontend/src/locales/en/nav.json` | 移除 `"wowClass"` 導覽項目 |
| `frontend/src/locales/zh-TW/dashboard.json` | 移除 `wowClassAssignments`、`wowClassAllDone`、`wowClassIgnore` 三個翻譯鍵 |
| `frontend/src/locales/en/dashboard.json` | 移除同上三個翻譯鍵 |

---

### 3. 將非中英文語系移至 `locale/extra-langs` 分支

共 8 個語系（72 個 JSON 檔）已完整保存於 `locale/extra-langs` 分支，從 main 移除以精簡代碼庫。

| 語系資料夾 | 語言 | 狀態 |
|------------|------|------|
| `frontend/src/locales/de/` | 德文 | 保存至 locale/extra-langs |
| `frontend/src/locales/fil/` | 菲律賓文 | 保存至 locale/extra-langs |
| `frontend/src/locales/hi/` | 印地文 | 保存至 locale/extra-langs |
| `frontend/src/locales/id/` | 印尼文 | 保存至 locale/extra-langs |
| `frontend/src/locales/it/` | 義大利文 | 保存至 locale/extra-langs |
| `frontend/src/locales/ja/` | 日文 | 保存至 locale/extra-langs |
| `frontend/src/locales/ko/` | 韓文 | 保存至 locale/extra-langs |
| `frontend/src/locales/vi/` | 越南文 | 保存至 locale/extra-langs |

> **main 分支保留語系：** `zh-TW`（繁體中文）、`en`（英文）
> `frontend/src/i18n/index.js` 原本即只載入 zh-TW 與 en，無需修改。

---

## 二、本次差異統計

```
94 個檔案變更，新增 4 行，刪除 3121 行
```

---

## 三、Git 提交歷程（完整紀錄）

以下為本 repository 的完整 commit 歷程（由新至舊）：

```
c92347c fix: remove unused '_' variable in ErrorBoundary catch block to fix ESLint CI failure
b16b107 fix: remove unused catch binding in ErrorBoundary.jsx to pass lint
e09c2f3 Merge pull request #7 from linyh465/copilot/fix-bug-report-email
62af048 feat: send bug reports via email on React errors
4d8bcaa Initial plan
8e8f92e fix: ensure keepalive job always has a runnable step
2614df3 fix: optimize sync performance and fix multiple bugs
28ea1cf fix(ci): resolve secrets context error in keepalive workflow
97b36ff Merge pull request #6 from linyh465/claude/review-project-architecture-EFn7Z
7c0f744 docs: add architecture review with improvement suggestions
1f2832a Initial commit
70114ab chore: 封存玩課雲功能、語言精簡至中英文
5ae5278 fix: 修正 TronClass 爬蟲 — 改用 Keycloak SSO 登入 + 正確 API 路徑
df00b60 WOW class 名稱變更
64be74c fix: 限制 TronClass 連線重試次數上限為 2 次
2ebf527 fix: 玩課雲無法連線時 fallback 到 mock 資料而非 502
370e632 fix: 修正玩課雲同步任務問題 — 翻譯、語系、title、同步順序
72552e8 fix: 修正 Settings 測試 — 主題選項改為 select/option 結構後的比對方式
c5a13ca fix: 修正 ESLint flat config 下 vite.config.js process 未定義問題
8cbeea9 fix: 修正 vite.config.js ESLint no-undef process 錯誤
78b6adb feat: 移轉至 Koyeb + GitHub Pages + 可插拔 Storage 架構
acd4cf8 refactor(settings): 語言、明暗主題、色彩主題改為下拉式選單
9479040 feat(backend): 新增可插拔任務儲存後端（local / sheets / supabase）
bf0613d feat(i18n): 新增菲律賓語（fil）、印尼語（id）、印度語（hi）支援
ea150e3 fix(lint): 移除未使用的 tCommon 變數
102c085 feat(i18n): 新增多語言支援（zh-TW、en、ja、ko、de、it、vi）
e366aca fix(test): 改用 getByRole 查詢按鈕，避免 SVG 干擾文字匹配
f9e31ff Merge branch 'dev'
8c08a72 fix(test): 更新 Tasks 測試按鈕文字 新增 → 新增任務
bf323b1 Merge branch 'dev'
b788b0e fix: 移除 effect 內多餘的 setCountdown 呼叫
1cbc2d5 Merge branch 'dev'
6b78d63 fix: 移除衍生 showPrompt state，解決 react-hooks/set-state-in-effect
3c6962d Merge branch 'dev'
ba36fc9 fix: CI 強制使用 Node.js 24 執行環境
8279873 Merge branch 'dev'
0aa04bc fix: 修正 ESLint useEffect 缺少依賴 + CI 升級 Node 24
6e3bbf9 ci: merge dev into main — GitHub 更新彈窗 + CI 修正 [skip ci]
aebbbb2 feat: 新增 GitHub 更新彈窗 + 修正 CI 分支自動同步
1530bb3 feat: 任務頁新增任務按鈕獨立顯示，不收納入選單
2e0ae47 Merge branch 'dev'
0df8704 .gitignore 新增
c97aaac feat: 手機版頁面標題新增右上角收納選單
c619d7d Merge branch 'dev': fix 行動版設定頁彈窗 Portal 定位
30a5340 fix: 使用 Portal 修正行動版設定頁彈窗定位問題
144094a Merge branch 'dev': fix 設定頁彈窗 z-index
1fd94fe fix: 修正設定頁彈窗被底部導航列遮蓋問題
f7b6964 fix : 修正桌面版任務按鈕消失
01e8735 feat: Introduce Settings page with account management, theme selection, notification preferences, and data synchronization, along with its test file and a future plan document.
354f027 feat: implement application layout with desktop sidebar and two-layer mobile navigation supporting swipe gestures.
d95396e feat: add CI workflow and implement responsive application layout with desktop sidebar and mobile two-layer navigation.
c55ebef Merge branch 'main' into dev
2ba371b 修復CI+導覽列修復
f926f4e fix: 修復導覽列學校右滑、任務鍵
825c191 awk 過濾條件改為只匹配 IPv4 位址
ded7f7c 更新nginx:stable-alpine
2091489 更新CI、部署設定
14ae123 fix: railway重新部署
18107f8 修正部署錯誤
925a55f fix:CI、Railway部署錯誤
65e220b 修正導覽列第二層、課表捲動bug、其他小bug
264c3c4 修正CI
2ad2203 手機版修正導覽列、課表捲動
f7f0b63 Merge branch 'dev'
7bffe59 feat: 新增色彩主題系統與 UI 動效優化
340c796 修正工作流程指南
0eed67a Merge branch 'dev' of https://github.com/linyh465/Pioyu_2026 into dev
b68daac fix: 修正課表顯示、首頁顯示
b22a16b chore: 更新版本至 0.2.0
fcf2e28 docs: 更新工作流程文件、AI提問文件
f258ef7 Merge branch 'dev'
80cc419 fix: UI/UX bug
0ace417 CI work update
04c3cc0 feat: 新增個人任務同步功能
ba00490 更新全新logo
176961a feat: 300 line bus
91a3747 CI check
98df1e4 feat: the rank of grades
ec3b4d4 fix: course schedule time
2e7d9f8 生成說明簡報
5af8c24 網頁開啟淺色模式bug修正
3d95102 任務頁面修正
116d629 前端每台裝置自動產生 UUID+冷卻時間10min
da6aebb fix: 修復前端 Railway 部署設定（動態 PORT、移除 proxy_pass）
2363813 修正部署
15fa393 修正: 建立 cache 目錄並授權 appuser，解決容器啟動 PermissionError
e7d3dcc 修正: 使用 Railway PORT 環境變數，解決 health check 失敗
5e02170 修正: 跳過 health check 路徑的 HTTPS 重導向，解決 Railway 部署卡住
4970d04 新增 Railway 設定檔
0f0035a 更新
99708c7 修正CI工作流
3969746 修復更新txt
1559d78 更新首頁版面
45f8fbe 公車追蹤更新、手機版面更新
332dc03 修正公車追蹤
c3cb8fb Merge remote-tracking branch 'origin/copilot/review-security-issues'
dcd2795 修正同步問題、冷卻時間
742a170 建議
b0aba7c fix: address review feedback — password min_length, CSP header
37573a0 fix: SQL injection prevention, input validation, security headers, and production docs toggle
d03ec04 清除課表、成績bug修正
7ee4b05 修改成績、課表清除功能bug
efffa31 首頁更新圖示有快取資料仍顯示未同步debug
f5fcc93 同步校務資料首頁小圖示更新
d0bb031 校務資料同步功能大更新+資安防護+清除功能+鎖定機制
8daa798 feat: 首頁版面重構  移除AI助理、新增任務預覽卡片
07aee51 刪除首頁四按鈕、AI功能，新增首頁任務聯動檢視
959a3cc 淺色、深色模式bug修正
4575465 Merge pull request #3 from linyh465/copilot/fix-github-ci-upload-issue
e5ad3a8 fix: remove unused 'plate' variable in Transport.jsx to fix ESLint CI failure
ed4ad0c Initial plan
dda87d2 修正公車動態
b0a9e1d merge: integrate new-update into main
20f897a 更新?
46490d9 Merge: 移除敏感快取檔案追蹤
37b2864 backup: remove sensitive cache files from git tracking per .gitignore policy
07f4605 來自雲端代理程式工作階段的 VS Code 的檢查點
9875402 修復?
b01f937 fix: remove unused imports to pass CI lint
1e9053a 更新公車動態頁面
f88288d add expertmental features
dc15f36 02212137 主要程式已修復完成
2d9f841 02210440 big version update recovery
54c627c 02210918 refresh TDX
84c8fb9 02202040 update
9a14c3a 02201522 update CSS
8df1cf7 02201512 Finish scraper to PU Website
c717abc 02201248 first commit
```

---

## 四、目前 main 分支保留的語系

| 資料夾 | 語言 |
|--------|------|
| `frontend/src/locales/zh-TW/` | 繁體中文（主要語言） |
| `frontend/src/locales/en/` | 英文 |

---

## 五、分支說明

| 分支 | 用途 |
|------|------|
| `main` | 主要開發分支，僅保留中英文語系，已移除 GitHub Pages/Koyeb/玩課雲 |
| `dev` | 開發分支 |
| `locale/extra-langs` | 暫存 8 種額外語系（de/fil/hi/id/it/ja/ko/vi），未來若需啟用可從此分支合併 |
| `gh-pages` | 舊 GitHub Pages 靜態部署分支（已停用 workflow，分支本身保留） |
