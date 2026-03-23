/**
 * PWA 更新服務 / PWA Update Service
 * 模組單例：讓 Settings 頁面可手動觸發 Service Worker 更新檢查。
 * Module singleton: allows Settings page to manually trigger SW update check.
 *
 * 使用方式 / Usage:
 *   import { checkForUpdate } from '../services/pwaUpdate';
 *   const result = await checkForUpdate(); // 'updated' | 'latest' | false
 */

let _registration = null; // ServiceWorkerRegistration
let _updateServiceWorker = null; // from useRegisterSW

/**
 * 由 PWAReloadPrompt 呼叫，將 SW registration 存入單例。
 * Called by PWAReloadPrompt to store the SW registration.
 */
export function setSwRegistration(r) {
    _registration = r;
}

/**
 * 由 PWAReloadPrompt 呼叫，將 updateServiceWorker 函式存入單例。
 * Called by PWAReloadPrompt to store the updateServiceWorker function.
 */
export function setUpdateServiceWorker(fn) {
    _updateServiceWorker = fn;
}

/**
 * 啟動等待中的 SW（若有），否則重新整理頁面。
 * Activate the waiting SW (if any), or reload the page.
 */
function _activateWaiting(reg) {
    if (_updateServiceWorker) {
        _updateServiceWorker(true);
    } else if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
    }
}

/**
 * 手動觸發 Service Worker 更新檢查。
 * Manually trigger SW update check.
 *
 * @returns {Promise<'updated'|'latest'|false>}
 *   'updated' — 找到新版並已觸發重載
 *   'latest'  — 已是最新版本
 *   false     — Service Worker 尚未就緒
 */
export async function checkForUpdate() {
    const reg = _registration ?? (
        'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null
    );
    if (!reg) return false;

    // 若已有等待中的新版 SW，直接啟動
    if (reg.waiting) {
        _activateWaiting(reg);
        return 'updated';
    }

    // 向網路請求最新 SW 檔案
    try {
        await reg.update();
    } catch {
        // update() 失敗不影響後續檢查
    }

    // 等待最多 5 秒，看是否有新版進入 waiting 狀態
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (reg.waiting) {
            _activateWaiting(reg);
            return 'updated';
        }
    }

    return 'latest';
}
