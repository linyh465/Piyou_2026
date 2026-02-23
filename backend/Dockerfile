# ── 披呦後端 Dockerfile / Piyou Backend Dockerfile ──
# Multi-stage build: 先安裝依賴，再複製應用程式碼，縮小映像並加速 rebuild。

FROM python:3.12-slim AS base

# 不寫 .pyc、不緩衝 stdout/stderr（容器日誌即時輸出）
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── 依賴安裝層（僅 requirements.txt 改變時才重新 build）──
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── 應用程式碼 ──
COPY . .

# ── 以非 root 身份執行（安全最佳實踐）──
RUN adduser --disabled-password --gecos '' --uid 1001 appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
