/**
 * PWA 更新服務 / PWA Update Service
 * 模組單例：讓 Settings 頁面可手動觸發 Service Worker 更新檢查。
 * Module singleton: allows Settings page to manually trigger SW update check.
 *
 * 使用方式 / Usage:
 *   import { checkForUpdate } from '../services/pwaUpdate';
 *   await checkForUpdate(); // 觸發後若有新版，PWAReloadPrompt 會自動彈出
 */

let _registration = null; // ServiceWorkerRegistration

/**
 * 由 PWAReloadPrompt 呼叫，將 SW registration 存入單例。
 * Called by PWAReloadPrompt to store the SW registration.
 */
export function setSwRegistration(r) {
    _registration = r;
}

/**
 * 手動觸發 Service Worker 更新檢查。
 * Manually trigger SW update check.
 * 若偵測到新版，會讓 useRegisterSW 的 needRefresh 變為 true，
 * PWAReloadPrompt 彈窗自動出現。
 * @returns {Promise<boolean>} true 若成功觸發檢查，false 若 registration 尚未就緒
 */
export async function checkForUpdate() {
    const reg = _registration ?? (
        'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null
    );
    if (!reg) return false;
    await reg.update();
    return true;
}
