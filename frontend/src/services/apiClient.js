import axios from 'axios';
import { retryWithBackoff } from '../utils/retryWithBackoff';

// ── API Base Configuration ──
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// ── HTTPS Enforcement ──
apiClient.interceptors.request.use((config) => {
    if (import.meta.env.PROD) {
        const url = new URL(config.baseURL, window.location.origin);
        if (url.protocol !== 'https:') {
            return Promise.reject(new Error('HTTPS is required for all API requests in production.'));
        }
    }
    return config;
});

// ── 裝置 UUID / Device UUID ──
// 每台裝置生成一組永久 UUID，隨所有請求傳送至後端作為冷卻追蹤 key。
// Generates a persistent UUID per device, sent with every request for cooldown tracking.
function getDeviceId() {
    let id = localStorage.getItem('piyou_device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('piyou_device_id', id);
    }
    return id;
}

// ── Auth Token + Device ID Injection ──
apiClient.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('piyou_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Device-Id'] = getDeviceId();
    return config;
});

// ── Response Error Handler ──
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            sessionStorage.removeItem('piyou_token');
            // 僅清除 token，不強制跳轉，避免首頁 API 呼叫失敗時被導回設定頁
        }
        return Promise.reject(error);
    }
);

/**
 * 將 API 錯誤轉換為對使用者安全的訊息。
 * Converts API errors to user-safe messages — never leaks backend internals or 5xx details.
 * @param {Error} err - Axios error object
 * @param {string} fallback - Default message if no specific mapping applies
 * @returns {string}
 */
export function apiError(err, fallback = '發生錯誤，請稍後再試') {
    const status = err?.response?.status;
    if (!status) {
        // 網路層錯誤（timeout / offline）
        return '網路連線失敗，請確認網路後再試';
    }
    if (status === 429) return '操作過於頻繁，請稍後再試';
    if (status === 401) return '請重新登入';
    if (status === 403) return '您沒有執行此操作的權限';
    if (status === 404) return '找不到相關資料';
    if (status >= 500) return '伺服器暫時無法使用，請稍後再試';
    // 4xx — 後端 detail 通常是開發者友善的中文訊息，但限長度防萬一
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string' && detail.length <= 120) return detail;
    return fallback;
}

// ── Public API with Retry ──
export const api = {
    async get(url, config) {
        return retryWithBackoff(() => apiClient.get(url, config));
    },
    async post(url, data, config) {
        return retryWithBackoff(() => apiClient.post(url, data, config));
    },
    async put(url, data, config) {
        return retryWithBackoff(() => apiClient.put(url, data, config));
    },
    async delete(url, config) {
        return retryWithBackoff(() => apiClient.delete(url, config));
    },
};

export default apiClient;
