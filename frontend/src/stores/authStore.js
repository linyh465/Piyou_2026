/**
 * 認證狀態管理 / Authentication Store
 * 處理登入、登出、Token 管理及安全憑證存儲流程
 * Handles login, logout, token management, and secure credential storage flow.
 */
import { create } from 'zustand';
import { api } from '../services/apiClient';
import secureStorage from '../services/secureStorage';

const useAuthStore = create((set, get) => ({
    // 狀態 / State
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    loginErrorCount: 0,

    /**
     * 登入 / Login
     * 將帳密傳送至後端，後端代理校務系統驗證後回傳 JWT。
     * Sends credentials to backend which proxies school auth and returns JWT.
     */
    login: async (studentId, password) => {
        set({ isLoading: true, error: null });

        const currentErrors = get().loginErrorCount;
        if (currentErrors >= 2) {
            set({ isLoading: false, error: '登入錯誤次數過多，請稍後再試 / Too many failed attempts' });
            return false;
        }
        try {
            const res = await api.post('/auth/login', {
                student_id: studentId,
                password: password,
            });

            const { token, user } = res.data;

            // 儲存 Token 至 Session / Store token in session
            sessionStorage.setItem('piyou_token', token);

            // 我們不再自動將帳號密碼存入 Secure Storage
            // await secureStorage.set('credentials', { studentId, password });

            set({
                user,
                token,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                loginErrorCount: 0, // Reset on success
            });

            return true;
        } catch (err) {
            const message = err.response?.data?.detail || '登入失敗，請確認帳號密碼 / Login failed, please check credentials';
            set((state) => ({
                isLoading: false,
                error: message,
                loginErrorCount: state.loginErrorCount + 1
            }));
            return false;
        }
    },

    /**
     * 登出 / Logout
     * 清除所有認證狀態與安全儲存
     * Clears all auth state and secure storage.
     */
    logout: async () => {
        sessionStorage.removeItem('piyou_token');
        await secureStorage.remove('credentials');
        set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
        });
    },

    /**
     * 嘗試自動登入 / Try auto-login
     * 從安全儲存取得帳密嘗試重新登入
     * Attempts re-login from securely stored credentials.
     */
    tryAutoLogin: async () => {
        // 從 sessionStorage 讀取 token 來判斷是否已經有 token
        const token = sessionStorage.getItem('piyou_token');
        if (token) {
            // (可選) 驗證 token 或直接標記為 true
            set({ isAuthenticated: true, token });
            return true;
        }
        return false;
    },

    clearError: () => set({ error: null }),
}));

export default useAuthStore;
