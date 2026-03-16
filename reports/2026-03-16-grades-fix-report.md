# 2026-03-16 成績頁面修復報告

**日期：** 2026-03-16
**執行者：** Claude Opus 4.6 (claude-opus-4-6)
**分支：** main

---

## 一、修復摘要

本次共修復成績頁面（Grades）5 項問題，涉及排名解析、平均分顯示、UI 元素清理與分數配色。

---

## 二、修復項目

### 1. 修復排名預設人數 45/180（Bug）

**問題：** 後端回傳 `class_rank: "5/60"`、`dept_rank: "12/120"` 格式字串，但前端未解析，直接 fallback 到硬編碼的 `classTotal=45`、`deptTotal=180`，導致排名人數永遠錯誤。

**修復：**
- 新增 `parseRank("5/60")` → `{ rank: 5, total: 60 }` 解析函數
- 移除 `classTotal`、`deptTotal` 硬編碼變數
- 所有排名顯示改用解析後的數值

| 檔案 | 變更 |
|------|------|
| `frontend/src/pages/Grades.jsx` | 新增 `parseRank()` 函數，重構排名變數 |
| `frontend/src/test/Grades.test.jsx` | 更正 mock 資料格式為字串 `"5/60"` |

---

### 2. 修復排名百分比計算（Bug）

**問題：** `RankBar` 元件接收字串型態的 `rank`，進行 `rank / total * 100` 運算得到 `NaN`，Top X% 無法正確顯示。

**修復：** 透過 Step 1 的 `parseRank()` 解析後，`RankBar` 現在接收數字型態，運算正常。

---

### 3. 平均分與 GPA 並列圓餅圖（Enhancement）

**問題：** 加權平均分只以純文字顯示在「修課成績」標題旁邊，不夠直覺。

**修復：**
- 新增 `AvgGauge` 圓形儀錶元件（滿分 100）
- GPA 圓餅圖與平均分圓餅圖並列於總覽卡片中
- 移除舊的純文字平均分顯示

| 檔案 | 變更 |
|------|------|
| `frontend/src/pages/Grades.jsx` | 新增 `AvgGauge` 元件，修改總覽卡片排版 |
| `frontend/src/locales/zh-TW/grades.json` | 新增 `"weightedAvg": "加權平均"` |
| `frontend/src/locales/en/grades.json` | 新增 `"weightedAvg": "Weighted Avg"` |
| `frontend/src/index.css` | 新增 `.grade-gauges-row` CSS 類別 |

---

### 4. 移除打勾符號 ✓（UI 清理）

**問題：** 分數 >= 60 時顯示 ✓ 符號，使用者認為不需要。

**修復：** 刪除 ✓ 顯示邏輯（3 行 JSX）。

| 檔案 | 變更 |
|------|------|
| `frontend/src/pages/Grades.jsx` | 移除 `✓` 顯示條件渲染 |

---

### 5. 及格/不及格雙色（Enhancement）

**問題：** 分數配色使用 3 色（綠 >=80、橘 60-79、紅 <60），不夠明確區分及格/不及格。

**修復：** `scoreColor()` 簡化為 2 色：
- **綠色** `var(--color-success)`: 及格（>= 60 分）
- **紅色** `var(--color-danger)`: 不及格（< 60 分）
- 非數字成績（通過、缺等）維持灰色 `var(--text-muted)`

| 檔案 | 變更 |
|------|------|
| `frontend/src/pages/Grades.jsx` | 簡化 `scoreColor()` 函數 |

---

## 三、變更檔案總覽

| 檔案 | 類型 |
|------|------|
| `frontend/src/pages/Grades.jsx` | 修改（5 項修復） |
| `frontend/src/test/Grades.test.jsx` | 修改（更正 mock 資料格式） |
| `frontend/src/locales/zh-TW/grades.json` | 修改（新增翻譯鍵） |
| `frontend/src/locales/en/grades.json` | 修改（新增翻譯鍵） |
| `frontend/src/index.css` | 修改（新增 CSS 類別） |

---

## 四、測試狀態

- 前端測試因既有的 `localStorage` 環境設定問題無法在本機執行（`TypeError: localStorage.getItem is not a function`），此為測試環境設定問題，非本次變更導致。
- 已更新 `Grades.test.jsx` 的 mock 資料以符合實際後端資料格式。

---

## 五、後續建議

1. 修復測試環境的 `localStorage` mock 問題（`src/test/setup.js` 或 `src/i18n/index.js`）
2. 考慮在總覽卡片中顯示「當學期 GPA」而非「歷年 GPA」
3. 考慮在課程列表中加入 GPA 等第（A+, A, B+ 等）
4. 考慮將排名卡片合併到總覽卡片中，減少頁面滑動
