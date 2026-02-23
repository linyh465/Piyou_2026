# 建議的工作流程

日常開發
# 1. 開始工作前，先拉取最新的遠端更新
git pull

# 2. 進行開發工作（編輯檔案）

# 3. 查看變更狀態
git status

# 4. 暫存變更
git add .
# 或選擇性暫存
git add 特定檔案

# 5. 提交變更（使用有意義的訊息）
git commit -m "描述你的變更"

# 6. 推送到遠端
git push

合併回主分支的流程

# 1. 確保 new-update 分支最新
git pull

# 2. 切換到 main 分支
git switch main

# 3. 拉取最新的 main
git pull

# 4. 合併 new-update 到 main
git merge new-update

# 5. 解決任何衝突（如果有）

# 6. 推送更新後的 main
git push

# 7. 切回 new-update 繼續開發
git switch new-update
