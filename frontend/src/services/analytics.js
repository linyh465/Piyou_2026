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
                extra,
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
}
