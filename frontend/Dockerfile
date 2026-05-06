# ── 披呦前端 Dockerfile / Piyou Frontend Dockerfile ──
# Multi-stage: Node build → Nginx 靜態檔案服務

# ── Stage 1: Build ──
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 支援 build-time 注入 API 網址（Railway / 生產環境用）
# Support build-time API URL injection (for Railway / production)
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── Stage 2: Serve with Nginx ──
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# 模板放在 /tmp，避免 nginx entrypoint 自動 envsubst 替換所有環境變數
# （會破壞 nginx 內建的 $host / $uri 等變數，導致設定檔無效）
COPY nginx.conf /tmp/default.conf.template

# 移除 nginx 預設 server 設定，避免監聽埠衝突
RUN rm -f /etc/nginx/conf.d/default.conf

# Railway 透過 PORT 環境變數指定埠號，本地預設 80
# Railway assigns port via PORT env var, default 80 for local
ENV PORT=80
# Docker Compose 預設後端位址；Railway 請設定為後端公開 URL
# Default backend URL for Docker Compose; set to public URL on Railway
ENV BACKEND_URL=http://backend:8000
EXPOSE ${PORT}

CMD ["/bin/sh", "-c", "sed -i 's/^worker_processes.*/worker_processes 1;/' /etc/nginx/nginx.conf && NAMESERVER=$(awk '/^nameserver/{if($2~/^[0-9]+\\./){print $2;exit}}' /etc/resolv.conf); export NAMESERVER=${NAMESERVER:-8.8.8.8}; envsubst '${PORT} ${BACKEND_URL} ${NAMESERVER}' < /tmp/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
