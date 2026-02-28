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
# 以 template 形式複製，啟動時用 envsubst 注入 $PORT
# Copy as template, inject $PORT at startup via envsubst
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Railway 透過 PORT 環境變數指定埠號，本地預設 80
# Railway assigns port via PORT env var, default 80 for local
ENV PORT=80
EXPOSE ${PORT}

CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
