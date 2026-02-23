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
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
