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

// ── Auth Token Injection ──
apiClient.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('piyou_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
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
