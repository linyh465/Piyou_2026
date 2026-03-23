import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages base path 設定 / GitHub Pages base path config
// 部署到子目錄時設定 VITE_BASE_PATH（如 /Piyou_2026/）
// Set VITE_BASE_PATH when deploying to a subdirectory (e.g. /Piyou_2026/)
// 有自訂網域時保持預設 '/' / Keep default '/' when using custom domain
const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest：使用自訂 SW（src/sw.js），支援 Push 事件處理
      // injectManifest: uses custom SW (src/sw.js) for Push event handling
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: [
        'pwa-192x192.svg',
        'pwa-512x512.svg',
        'apple-touch-icon.svg',
        'sql-wasm.wasm',
      ],
      manifest: {
        name: '披呦 Piyou — 校園智慧助理',
        short_name: '披呦',
        description: '靜宜大學校園智慧助理：課表、成績、公車、任務一站式查詢',
        theme_color: '#0072ff',
        background_color: '#0f0f14',
        display: 'standalone',
        scope: basePath,
        start_url: basePath,
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        // 預快取所有靜態資源 / Precache all static assets
        globPatterns: ['**/*.{js,css,html,svg,wasm,json}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    server: {
      deps: {
        inline: ['sql.js'],
      },
    },
    onConsoleLog(log) {
      // 過濾 sql.js WASM 相關 stderr 雜訊
      if (log.includes('sql-wasm.wasm')) return false;
    },
  },
})
