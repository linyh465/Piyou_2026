# 變更報告 — 紫櫻主題更新 / Change Report — Sakura Theme Update

**日期 / Date:** 2026-03-22  
**分支 / Branch:** `copilot/update-theme-colors`

---

## 變更摘要 / Summary of Changes

本次共修改 2 個檔案，針對淺色模式背景色及紫藤（現更名為紫櫻）主題色進行調整。

---

## 變更明細 / Detailed Changes

### 1. `frontend/src/index.css`

#### 淺色模式背景色 / Light Mode Background

| 屬性 | 舊值 | 新值 |
|------|------|------|
| `--bg`（淺色模式主背景）| `#F2F2F7` | `#FFFFFF`（白色）|

#### 紫櫻主題 CSS / Wisteria → Sakura Theme CSS

| 屬性 | 舊值 | 新值 |
|------|------|------|
| 區塊註解 | `紫藤 Wisteria — 幽夢花期` | `紫櫻 Wisteria — 微醺紫粉` |
| `--color-brand` | `#C026D3` | `#F9DCFD` |
| `--color-brand-gradient` | `linear-gradient(135deg, #C026D3, #E879F9)` | `linear-gradient(135deg, #F9DCFD, #E879F9)` |
| `--ring-brand`（淺色）| `rgba(192, 38, 211, 0.25)` | `rgba(249, 220, 253, 0.25)` |
| `--ring-brand`（深色）| `rgba(192, 38, 211, 0.35)` | `rgba(249, 220, 253, 0.35)` |
| `--color-brand-subtle`（深色）| `rgba(192, 38, 211, 0.12)` | `rgba(249, 220, 253, 0.12)` |

### 2. `frontend/src/stores/themeStore.js`

| 欄位 | 舊值 | 新值 |
|------|------|------|
| `label` | `紫藤` | `紫櫻` |
| `description` | `幽夢花期` | `微醺紫粉` |
| `color` | `#C026D3` | `#F9DCFD` |

---

## 未更動項目 / Unchanged Items

- 主題 ID（`wisteria`）不變，保持向後相容性
- `labelEn`（`Wisteria`）不變
- `--color-brand-light`、`--color-brand-dark` 不變
- 其他所有主題及功能均未修改
- 深色模式（`--bg` 在 `.dark` 中）未更動

---

## CI 狀態 / CI Status

- ✅ 前端 lint（ESLint）通過
- ✅ 前端單元測試（Vitest）通過
- ✅ 後端測試（pytest）不受影響
