/**
 * PWA Push 訂閱服務 / PWA Push Subscription Service
 * 管理瀏覽器推播訂閱的生命週期：請求權限、訂閱、取消訂閱、傳給後端。
 * Manages browser push subscription lifecycle: permission, subscribe, unsubscribe, sync to backend.
 */

const API = import.meta.env.VITE_API_URL || '';

// ── VAPID 公鑰轉換 / Convert base64url VAPID public key to Uint8Array ──
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// ── 取得 VAPID 公鑰 / Fetch VAPID public key from backend ──
async function fetchVapidKey() {
    const res = await fetch(`${API}/api/v1/notify/push/vapid-key`);
    if (!res.ok) throw new Error('VAPID key not available');
    const { vapid_public_key } = await res.json();
    return vapid_public_key;
}

// ── 同步訂閱至後端 / Sync subscription to backend ──
async function syncToBackend(subscription) {
    const { endpoint, keys } = subscription.toJSON();
    const deviceId = localStorage.getItem('piyou_device_id') || 'unknown';
    await fetch(`${API}/api/v1/notify/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId },
        body: JSON.stringify({
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            device_id: deviceId,
        }),
    });
}

// ── 從後端移除訂閱 / Remove subscription from backend ──
async function removeFromBackend(subscription) {
    const { endpoint, keys } = subscription.toJSON();
    await fetch(`${API}/api/v1/notify/push/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, p256dh: keys?.p256dh || '', auth: keys?.auth || '' }),
    }).catch(() => {});
}

/**
 * 檢查目前推播訂閱狀態 / Check current push subscription state.
 * @returns {'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'}
 */
export async function getPushStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
}

/**
 * 訂閱推播通知 / Subscribe to push notifications.
 * 自動請求通知權限、取得 VAPID key、建立訂閱並儲存至後端。
 * @returns {boolean} 是否成功訂閱 / Whether subscription succeeded
 */
export async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('此瀏覽器不支援推播通知 / Push not supported');
    }

    // 請求通知權限 / Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('通知權限被拒絕 / Notification permission denied');

    const vapidKey = await fetchVapidKey();
    const reg = await navigator.serviceWorker.ready;

    const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await syncToBackend(subscription);
    return true;
}

/**
 * 取消推播訂閱 / Unsubscribe from push notifications.
 * @returns {boolean}
 */
export async function unsubscribePush() {
    if (!('serviceWorker' in navigator)) return false;

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return false;

    await removeFromBackend(subscription);
    await subscription.unsubscribe();
    return true;
}
