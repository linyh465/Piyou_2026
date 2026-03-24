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
// Docker 本地部署使用 http://localhost，需排除 localhost 以免所有請求被攔截
// Exclude localhost so Docker local deployment works over HTTP
apiClient.interceptors.request.use((config) => {
    if (import.meta.env.PROD) {
        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        if (!isLocal) {
            const url = new URL(config.baseURL, window.location.origin);
            if (url.protocol !== 'https:') {
                return Promise.reject(new Error('HTTPS is required for all API requests in production.'));
            }
        }
    }
    return config;
});

// ── 裝置 UUID / Device UUID ──
// 每台裝置生成一組永久 UUID，隨所有請求傳送至後端作為冷卻追蹤 key。
// Generates a persistent UUID per device, sent with every request for cooldown tracking.
// 模組初始化時快取一次，避免每次請求讀取 localStorage。
const _DEVICE_ID = (() => {
    let id = localStorage.getItem('piyou_device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('piyou_device_id', id);
    }
    return id;
})();

// ── Auth Token + Device ID Injection ──
apiClient.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('piyou_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Device-Id'] = _DEVICE_ID;
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
 * 將 API 錯誤轉換為顯示訊息。
 * Converts API errors to display messages.
 * @param {Error} err - Axios error object
 * @param {string} fallback - Default message if no detail available
 * @returns {string}
 */
export function apiError(err, fallback = '發生錯誤，請稍後再試') {
    if (!err?.response) return '網路連線失敗，請確認網路後再試';
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
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
