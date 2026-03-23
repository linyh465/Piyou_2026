/* global clients, self */
/**
 * 自訂 Service Worker / Custom Service Worker
 * 使用 VitePWA injectManifest 策略，由 Vite 注入預快取清單並打包。
 * Uses VitePWA injectManifest strategy — Vite injects precache manifest and bundles this file.
 *
 * 包含：Workbox 預快取 + 執行期快取 + PWA Push 事件處理
 * Includes: Workbox precache + runtime caching + PWA Push event handling
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// ── Workbox 預快取 / Precache ──
// __WB_MANIFEST 由 VitePWA 在建置時注入 / Injected by VitePWA at build time
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── 執行期快取：API / Runtime cache: API ──
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/v1/'),
    new NetworkFirst({
        cacheName: 'api-cache',
        plugins: [
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 30 }),
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
        networkTimeoutSeconds: 5,
    })
);

// ── 執行期快取：字型與圖片 / Runtime cache: fonts & images ──
registerRoute(
    ({ request }) => request.destination === 'image' || request.destination === 'font',
    new CacheFirst({
        cacheName: 'assets-cache',
        plugins: [
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
        ],
    })
);

// ══════════════════════════════════════════
//  PWA Push 事件 / Push Event Handler
// ══════════════════════════════════════════

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data = {};
    try { data = event.data.json(); } catch { data = { title: event.data.text() }; }

    const title = data.title || '披呦';
    const options = {
        body: data.body || '',
        icon: '/pwa-192x192.svg',
        badge: '/pwa-192x192.svg',
        tag: data.tag || 'piyou-notification',
        renotify: true,
        data: { url: data.url || '/' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// ── 點擊通知 / Notification click ──
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});

// ── pushsubscriptionchange：訂閱到期自動重新訂閱 / Re-subscribe on expiry ──
self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
        }).then((newSubscription) => {
            // 通知主頁面更新訂閱 / Notify main page to update subscription
            return clients.matchAll().then((cs) => {
                cs.forEach((c) => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: newSubscription.toJSON() }));
            });
        })
    );
});
