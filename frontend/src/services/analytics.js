/**
 * 前端分析事件追蹤 / Frontend Analytics Event Tracking
 * Fire-and-forget — 永不拋出例外、不阻塞 UI。
 * Fire-and-forget — never throws, never blocks the UI.
 *
 * 批次策略 / Batching strategy:
 *   累積 BATCH_SIZE 筆或 BATCH_TIMEOUT ms 後統一送出，大幅減少請求次數。
 *   Accumulates BATCH_SIZE events or flushes after BATCH_TIMEOUT ms to cut request count.
 *
 * 使用方式 / Usage:
 *   import { trackEvent } from '../services/analytics';
 *   trackEvent('share_create');
 *   trackEvent('sync', { status: 'success' });
 */

const API = import.meta.env.VITE_API_URL || '';
const BATCH_SIZE = 8;      // 累積 8 筆即送出
const BATCH_TIMEOUT = 6000; // 或 6 秒後送出

// ── 模組層級快取（初始化一次，不重複計算）/ Module-level cache ──
const _deviceId = (() => {
    try {
        let id = localStorage.getItem('piyou_device_id');
        if (!id) { id = crypto.randomUUID(); localStorage.setItem('piyou_device_id', id); }
        return id;
    } catch { return 'unknown'; }
})();

// platform 只偵測一次，session 期間不會改變
const _platform = (() => {
    try {
        const ua = navigator.userAgent || '';
        if (navigator.userAgentData) {
            if (navigator.userAgentData.mobile) return 'mobile';
            if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return 'tablet';
            return 'desktop';
        }
        if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return 'tablet';
        if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
        return 'desktop';
    } catch { return 'unknown'; }
})();

// ── 批次佇列 / Batch queue ──
const _queue = [];
let _flushTimer = null;

function _flushQueue() {
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    if (!_queue.length) return;
    const events = _queue.splice(0, _queue.length);
    try {
        fetch(`${API}/api/v1/analytics/events/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events }),
        }).catch(() => {});
    } catch { /* 吞掉所有錯誤 */ }
}

function _scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(_flushQueue, BATCH_TIMEOUT);
}

/**
 * @param {string} eventType - page_view | page_duration | sync | share_create | share_subscribe | feedback_submit | button_click | bus_fetch | error
 * @param {object} [extra]   - 額外資料（選填）
 * @param {string} [page]    - 頁面路徑，page_view 事件使用
 */
export function trackEvent(eventType, extra = {}, page = '') {
    try {
        _queue.push({
            device_id: _deviceId,
            event_type: eventType,
            page,
            extra: { ...extra, platform: _platform },
        });
        if (_queue.length >= BATCH_SIZE) {
            _flushQueue();
        } else {
            _scheduleFlush();
        }
    } catch { /* 吞掉所有錯誤 */ }
}

// ── 全域未處理 Promise 錯誤追蹤 / Global unhandled rejection tracking ──
if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (e) => {
        trackEvent('error', { type: 'unhandled_rejection', message: String(e.reason).slice(0, 100) });
    });

    // ── 工作階段時長追蹤 / Session duration tracking ──
    const _sessionStart = Date.now();
    window.addEventListener('beforeunload', () => {
        // 先 flush 佇列中殘留的事件 / Flush any queued events before unload
        _flushQueue();

        const duration = Date.now() - _sessionStart;
        if (duration >= 5000) {
            // 用 sendBeacon batch 格式確保瀏覽器關閉時也能送出
            const payload = JSON.stringify({
                events: [{
                    device_id: _deviceId,
                    event_type: 'session_duration',
                    page: '',
                    extra: { platform: _platform, duration_ms: duration },
                }],
            });
            if (navigator.sendBeacon) {
                navigator.sendBeacon(`${API}/api/v1/analytics/events/batch`, new Blob([payload], { type: 'application/json' }));
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
