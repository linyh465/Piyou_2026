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
 *
 * 直接對 reg.waiting 發送 SKIP_WAITING 並監聽 controllerchange 後 reload。
 * 加 3 秒強制 reload fallback — Android Chrome 有時不觸發 controllerchange。
 */
function _activateWaiting(reg) {
    const waiting = reg.waiting;
    if (waiting) {
        let reloaded = false;
        const doReload = () => { if (!reloaded) { reloaded = true; window.location.reload(); } };
        navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
        waiting.postMessage({ type: 'SKIP_WAITING' });
        // Fallback: Android Chrome 有時 controllerchange 不觸發，3 秒後強制 reload
        setTimeout(doReload, 3000);
    } else if (_updateServiceWorker) {
        _updateServiceWorker(true);
    } else {
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

    // 等待單一 SW（安裝中或新找到的）的輔助函式
    // Helper: wait for a single SW to reach installed/redundant state
    function waitForInstall(sw, timeoutMs) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                sw.removeEventListener('statechange', onStateChange);
                resolve('latest');
            }, timeoutMs);

            function onStateChange() {
                if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                    clearTimeout(timer);
                    sw.removeEventListener('statechange', onStateChange);
                    resolve('installed');
                } else if (sw.state === 'redundant') {
                    clearTimeout(timer);
                    sw.removeEventListener('statechange', onStateChange);
                    resolve('redundant');
                }
            }

            sw.addEventListener('statechange', onStateChange);
        });
    }

    // 若已有正在安裝中的 SW（例如背景自動更新進行到一半），直接等候完成
    if (reg.installing) {
        const outcome = await waitForInstall(reg.installing, 15000);
        if (outcome === 'installed') {
            _activateWaiting(reg);
            return 'updated';
        }
        return 'latest';
    }

    return new Promise((resolve) => {
        // 5 秒後若無新版，視為已是最新
        const timer = setTimeout(() => {
            reg.removeEventListener('updatefound', onUpdateFound);
            resolve('latest');
        }, 5000);

        function onUpdateFound() {
            const sw = reg.installing;
            if (!sw) return;

            waitForInstall(sw, 15000).then((outcome) => {
                clearTimeout(timer);
                reg.removeEventListener('updatefound', onUpdateFound);
                if (outcome === 'installed') {
                    _activateWaiting(reg);
                    resolve('updated');
                } else {
                    resolve('latest');
                }
            });
        }

        reg.addEventListener('updatefound', onUpdateFound);

        // 觸發向伺服器請求最新 SW
        reg.update().catch(() => {});
    });
}
