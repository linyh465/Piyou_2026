# 變更報告 — 新增紫藤主題 / Change Report — Add Wisteria Theme

**日期 / Date:** 2026-03-22  
**分支 / Branch:** copilot/add-f9dcfd-theme

---

## 需求摘要 / Requirement Summary

新增以 `#F9DCFD` 為品牌色靈感的色彩主題，命名為 **紫藤（Wisteria）**，並整合至現有主題選單中；同時確認既有主題無錯誤。

Add a new color theme inspired by `#F9DCFD`, named **紫藤（Wisteria）**, and integrate it into the existing theme selector. Verify that existing themes have no bugs.

---

## 主題設計 / Theme Design

| 屬性 | 值 | 說明 |
|------|-----|------|
| **ID** | `wisteria` | 程式識別碼 |
| **中文名稱** | 紫藤 | 取自紫藤花，花穗輕垂、幽雅如夢 |
| **英文名稱** | Wisteria | |
| **描述** | 幽夢花期 | 如夢似幻的花開時節 |
| **主色 (`--color-brand`)** | `#C026D3` | 飽和洋紅紫，適合按鈕、連結、強調色 |
| **亮色 (`--color-brand-light`)** | `#E879F9` | 柔和粉紫，用於懸停/高光 |
| **暗色 (`--color-brand-dark`)** | `#A21CAF` | 深紫，用於按壓狀態 |
| **淡色 (`--color-brand-subtle`)** | `#F9DCFD` | ← **需求指定色**，作為淺色模式選中背景 |
| **漸層** | `linear-gradient(135deg, #C026D3, #E879F9)` | |
| **光暈** | `rgba(192, 38, 211, 0.25)` | 淺色模式 focus ring |

### 深色模式適配 / Dark Mode Adaptation

深色模式下覆蓋以下變數，確保對比度與可讀性：

```css
.dark.theme-wisteria,
.dark .theme-wisteria {
  --color-brand-subtle: rgba(192, 38, 211, 0.12);  /* 降低不透明度，避免過亮 */
  --ring-brand: rgba(192, 38, 211, 0.35);           /* 略提高光暈可見度 */
}
```

---

## 變更檔案 / Changed Files

### 1. `frontend/src/stores/themeStore.js`

在 `COLOR_THEMES` 陣列末尾新增紫藤主題條目：

```javascript
{ id: 'wisteria', label: '紫藤', labelEn: 'Wisteria', description: '幽夢花期', color: '#C026D3' },
```

`applyColorTheme()` 函式已透過遍歷 `COLOR_THEMES` 自動支援新主題，無需額外修改。

### 2. `frontend/src/index.css`

在現有色彩主題區段末尾（薔薇之後）新增 CSS 區塊：

```css
/* ── 紫藤 Wisteria — 幽夢花期 ── */
.theme-wisteria { ... }
.dark.theme-wisteria,
.dark .theme-wisteria { ... }
```

### 3. `frontend/src/pages/Settings.jsx`（無需修改）

設定頁面透過 `COLOR_THEMES.map()` 動態渲染主題選項，新增主題後自動出現於主題選單中，不需要手動修改。

---

## Bug 確認 / Bug Verification

檢查所有現有主題（default、azure、violet、amber、crimson、emerald、rose），確認：

- ✅ 每個主題均有淺色與深色兩段 CSS 規則
- ✅ `COLOR_THEMES` 陣列各項目均有完整欄位（`id`、`label`、`labelEn`、`description`、`color`）
- ✅ `applyColorTheme` 函式正確清除舊主題並套用新主題
- ✅ 主題選單 UI 正確透過 `.theme-swatch.active` 顯示已選中狀態

**未發現既有主題 bug。**

---

## 測試結果 / Test Results

執行 `npm run test`（Vitest）：

```
Test Files  13 passed (13)
     Tests  66 passed (66)
```

所有現有測試全部通過，無迴歸問題。

---

## 功能限制說明 / Non-Functional Changes

本次變更嚴格遵循「不得更改其他功能」要求：
- 未修改任何路由、資料流、API 呼叫或業務邏輯
- 僅新增 CSS 變數覆蓋規則與主題陣列條目
- Settings 頁面主題選單透過現有動態渲染機制自動整合新主題
