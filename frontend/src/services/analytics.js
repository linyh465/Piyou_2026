/**
 * 前端分析事件追蹤 / Frontend Analytics Event Tracking
 * Fire-and-forget — 永不拋出例外、不阻塞 UI。
 * Fire-and-forget — never throws, never blocks the UI.
 *
 * 使用方式 / Usage:
 *   import { trackEvent } from '../services/analytics';
 *   trackEvent('share_create');
 *   trackEvent('sync', { status: 'success' });
 */

const API = import.meta.env.VITE_API_URL || '';

function getDeviceId() {
    try {
        let id = localStorage.getItem('piyou_device_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('piyou_device_id', id);
        }
        return id;
    } catch {
        return 'unknown';
    }
}

/**
 * 偵測裝置平台類型 / Detect device platform type.
 * 回傳 'mobile' | 'tablet' | 'desktop' | 'unknown'
 */
function getPlatform() {
    try {
        const ua = navigator.userAgent || '';
        // 優先使用 userAgentData API（Chrome 89+, Edge 90+）
        // userAgentData.mobile=false 無法區分桌機與平板，仍需 UA fallback
        if (navigator.userAgentData) {
            if (navigator.userAgentData.mobile) return 'mobile';
            // userAgentData.mobile=false — check UA string for tablet before assuming desktop
            if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return 'tablet';
            return 'desktop';
        }
        // Fallback: User-Agent 字串解析
        if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return 'tablet';
        if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
        return 'desktop';
    } catch {
        return 'unknown';
    }
}

/**
 * @param {string} eventType - page_view | page_duration | sync | share_create | share_subscribe | feedback_submit | button_click | bus_fetch | error
 * @param {object} [extra]   - 額外資料（選填）
 * @param {string} [page]    - 頁面路徑，page_view 事件使用
 */
export function trackEvent(eventType, extra = {}, page = '') {
    try {
        fetch(`${API}/api/v1/analytics/event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device_id: getDeviceId(),
                event_type: eventType,
                page,
                // platform 合入 extra，後端統一從 extra.platform 讀取
                // platform placed last so it cannot be overridden by caller-supplied extra
                extra: { ...extra, platform: getPlatform() },
            }),
        }).catch(() => {}); // 吞掉網路錯誤 / Swallow network errors
    } catch {
        // 任何同步錯誤也吞掉 / Swallow any sync errors
    }
}

// ── 全域未處理 Promise 錯誤追蹤 / Global unhandled rejection tracking ──
if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (e) => {
        trackEvent('error', { type: 'unhandled_rejection', message: String(e.reason).slice(0, 100) });
    });

    // ── 工作階段時長追蹤 / Session duration tracking ──
    const _sessionStart = Date.now();
    window.addEventListener('beforeunload', () => {
        const duration = Date.now() - _sessionStart;
        if (duration >= 5000) {
            // 用 sendBeacon 確保瀏覽器關閉時也能送出
            const payload = JSON.stringify({
                device_id: getDeviceId(),
                event_type: 'session_duration',
                page: '',
                extra: { platform: getPlatform(), duration_ms: duration },
            });
            if (navigator.sendBeacon) {
                navigator.sendBeacon(`${API}/api/v1/analytics/event`, new Blob([payload], { type: 'application/json' }));
            }
        }
    });

    // ── PWA 安裝追蹤 / PWA install tracking ──
    window.addEventListener('appinstalled', () => {
        trackEvent('pwa_install', { action: 'installed' });
    });
    window.addEventListener('beforeinstallprompt', () => {
        trackEvent('pwa_install', { action: 'prompt_shown' });
    });
}
