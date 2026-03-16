# Git 工作流程與版本控制指南

> 確保程式碼安全、精細記錄開發歷程、快速回復錯誤的完整指南。

---

## 1. 核心觀念：分支策略

```
main ─────●─────────────●─────────────●── (穩定發布版)
           \           /               \
dev ────────●───●───●──● ───────────────●── (開發整合)
                 \     /
feature/xxx ──────●───●── (功能分支，用完即刪)
```

| 分支 | 用途 | 規則 |
|------|------|------|
| `main` | 穩定發布版 | **禁止直接 push**，只透過合併 `dev` 更新 |
| `dev` | 開發整合 | 所有功能在此匯合、測試 |
| `feature/*` | 單一功能開發 | 從 `dev` 建立，完成後合併回 `dev` 並刪除 |
| `hotfix/*` | 緊急修復 | 從 `main` 建立，修完合併回 `main` 和 `dev` |

---

## 2. 日常開發流程

### 2.1 開始新功能

```bash
# 切到 dev 並拉取最新
git checkout dev
git pull origin dev

# 建立功能分支（命名清楚）
git checkout -b feature/新增公車路線查詢
```

### 2.2 開發中：精細提交

```bash
# 查看變更
git status
git diff                    # 查看具體改了什麼

# 暫存特定檔案（推薦，比 git add . 更精確）
git add frontend/src/pages/Bus.jsx
git add backend/app/routers/bus.py

# 提交（一次只提交一個邏輯單元）
git commit -m "feat: 新增公車路線 300 號的站點資料"
```

#### Commit 訊息命名規範

| 前綴 | 用途 | 範例 |
|------|------|------|
| `feat:` | 新增功能 | `feat: 新增班級排名顯示` |
| `fix:` | 修復 Bug | `fix: 修正課表時間顯示錯誤` |
| `refactor:` | 重構（不改功能） | `refactor: 簡化任務同步邏輯` |
| `style:` | 樣式/排版 | `style: 調整設定頁面間距` |
| `docs:` | 文件更新 | `docs: 更新 API 說明文件` |
| `test:` | 測試相關 | `test: 新增成績轉換測試` |
| `chore:` | 雜務/設定 | `chore: 更新 .gitignore` |

### 2.3 推送到遠端備份

```bash
git push origin feature/新增公車路線查詢
```

### 2.4 功能完成：合併回 dev

```bash
# 先確保 dev 是最新的
git checkout dev
git pull origin dev

# 合併功能分支
git merge feature/新增公車路線查詢

# 如果有衝突 → 打開編輯器解決 → git add . → git commit
# 推送合併結果
git push origin dev

# 刪除已完成的功能分支（保持乾淨）
git branch -d feature/新增公車路線查詢
git push origin --delete feature/新增公車路線查詢
```

---

## 3. 版本發布

```bash
# 切到 main
git checkout main
git pull origin main

# 合併 dev
git merge dev
git push origin main

# 建立版本標籤
git tag -a v1.2.0 -m "Release v1.2.0: 新增公車路線查詢、修正課表時間"
git push origin v1.2.0
```

### 版本號規則（語意化版本）

| 類型 | 格式 | 時機 |
|------|------|------|
| 主版號 | `v2.0.0` | 架構大改、不相容的變更 |
| 次版號 | `v1.2.0` | 新增功能（向下相容） |
| 修訂號 | `v1.2.1` | Bug 修復 |

---

## 4. 緊急修復 (Hotfix)

線上發現嚴重 Bug 時，不需要等 dev 的進度，直接從 main 修：

```bash
# 從 main 建立 hotfix 分支
git checkout main
git checkout -b hotfix/修正登入驗證漏洞

# 修復完成後
git commit -m "fix: 修正登入驗證繞過漏洞"

# 合併回 main 並發布
git checkout main
git merge hotfix/修正登入驗證漏洞
git tag -a v1.2.1 -m "Hotfix: 修正登入驗證漏洞"
git push origin main --tags

# 同步到 dev（避免修復遺失）
git checkout dev
git merge hotfix/修正登入驗證漏洞
git push origin dev

# 清理
git branch -d hotfix/修正登入驗證漏洞
```

---

## 5. ⚡ 快速操作速查表

### 暫存工作進度（git stash）

開發到一半需要臨時切換分支？用 `stash` 暫存：

```bash
git stash                          # 暫存目前所有未提交的變更
git stash -m "做到一半的公車頁面"     # 附加說明

# 切去處理其他事情...

git stash pop                      # 回來後恢復暫存的變更
git stash list                     # 查看所有暫存
git stash drop stash@{0}           # 刪除特定暫存
```

### 快速修改上一次的提交

```bash
# 忘了加檔案或想改 commit 訊息
git add 遺漏的檔案.js
git commit --amend -m "fix: 修正課表顯示（補上遺漏的樣式檔）"
# ⚠ 僅限尚未 push 的 commit
```

### 快速查看歷史

```bash
git log --oneline -10              # 精簡顯示最近 10 筆
git log --oneline --graph --all    # 圖形化分支歷史
git log --author="你的名字"         # 只看自己的提交
```

### 比較差異

```bash
git diff                           # 工作目錄 vs 暫存區
git diff --staged                  # 暫存區 vs 最後一次 commit
git diff dev..main                 # 兩個分支的差異
```

---

## 6. 🔧 錯誤回復大全

### 情境 1：還沒 commit，想放棄所有修改

```bash
git checkout -- .                  # 放棄所有檔案修改
git checkout -- path/to/file.js    # 只放棄特定檔案
```

### 情境 2：已經 add，想取消暫存

```bash
git reset HEAD path/to/file.js     # 取消暫存特定檔案
git reset HEAD .                   # 取消暫存所有檔案
# 檔案內容不會被改變，只是從暫存區移除
```

### 情境 3：已經 commit，想撤銷（保留修改）

```bash
git reset --soft HEAD~1            # 撤銷最後 1 次 commit，修改保留在暫存區
git reset --mixed HEAD~1           # 撤銷最後 1 次 commit，修改保留在工作目錄
```

### 情境 4：已經 commit，想徹底丟棄

```bash
git reset --hard HEAD~1            # ⚠ 危險！徹底刪除最後 1 次 commit 和修改
```

### 情境 5：已經 push，想撤銷（安全方式）

```bash
# 建立一個「反向 commit」來撤銷，不會破壞歷史
git revert HEAD                    # 撤銷最後一次 push 的 commit
git revert <commit-hash>           # 撤銷特定 commit
git push origin dev
```

### 情境 6：不小心刪了分支或 commit

```bash
git reflog                         # 查看所有操作記錄（含已刪除的）
git checkout -b 救回的分支 <hash>    # 從 reflog 的 hash 救回
```

### 情境 7：合併後發現有問題，想回退合併

```bash
git revert -m 1 <merge-commit-hash>   # 撤銷合併
```

---

## 7. 常用 Git 別名設定（加速操作）

在終端執行以下命令，之後就能用簡短指令：

```bash
git config --global alias.st "status"
git config --global alias.co "checkout"
git config --global alias.br "branch"
git config --global alias.cm "commit -m"
git config --global alias.lg "log --oneline --graph --all --decorate"
git config --global alias.last "log -1 HEAD --stat"
```

設定後的使用方式：

```bash
git st                # = git status
git co dev            # = git checkout dev
git br                # = git branch
git cm "feat: 新功能"  # = git commit -m "feat: 新功能"
git lg                # = 圖形化 log
git last              # = 查看最後一次 commit 詳情
```

---

## 8. ⚠ 常見錯誤與注意事項

| ❌ 不要做 | ✅ 應該做 |
|-----------|----------|
| 在 `main` 上直接開發 | 建立 `feature/*` 分支 |
| `git add .` 然後直接 commit | 先 `git diff` 確認改了什麼 |
| commit 訊息寫「修改」「更新」 | 寫清楚改了什麼、為什麼改 |
| 一次 commit 包含多個不相關的修改 | 每個邏輯單元獨立 commit |
| 強制推送 `git push -f` 到共用分支 | 只在自己的功能分支使用 `--force` |
| 忘記同步 hotfix 到 dev | hotfix 永遠要同時合併到 `main` 和 `dev` |


前後端 啟用
~~~shell
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
~~~

~~~shell
cd frontend
npm run dev
~~~
