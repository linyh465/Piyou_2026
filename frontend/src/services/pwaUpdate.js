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
 * 使用事件驅動方式：監聽 updatefound → statechange(installed)，
 * 比輪詢更可靠，不受固定逾時限制（最長等 10 秒）。
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

    return new Promise((resolve) => {
        // 10 秒後若無新版，視為已是最新
        const timer = setTimeout(() => {
            reg.removeEventListener('updatefound', onUpdateFound);
            resolve('latest');
        }, 10000);

        function onUpdateFound() {
            const sw = reg.installing;
            if (!sw) return;

            function onStateChange() {
                // installed = SW 已安裝完成進入 waiting 狀態
                if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                    clearTimeout(timer);
                    reg.removeEventListener('updatefound', onUpdateFound);
                    sw.removeEventListener('statechange', onStateChange);
                    _activateWaiting(reg);
                    resolve('updated');
                } else if (sw.state === 'redundant') {
                    // 安裝失敗，不算有新版
                    sw.removeEventListener('statechange', onStateChange);
                }
            }

            sw.addEventListener('statechange', onStateChange);
        }

        reg.addEventListener('updatefound', onUpdateFound);

        // 觸發向伺服器請求最新 SW
        reg.update().catch(() => {});
    });
}
