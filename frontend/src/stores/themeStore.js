/**
 * 主題狀態管理 / Theme Store
 * 管理深淺色模式切換，持久化至 localStorage
 * Manages light/dark mode toggle, persisted to localStorage.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'piyou_theme';

function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
}

// 初始化 / Initialize
const saved = localStorage.getItem(STORAGE_KEY) || 'system';
applyTheme(saved);

const useThemeStore = create((set, get) => ({
    /** 'light' | 'dark' | 'system' */
    theme: saved,

    /** 解析後的實際主題 / Resolved active theme */
    resolvedTheme: saved === 'system' ? getSystemTheme() : saved,

    /**
     * 設定主題 / Set theme
     * @param {'light' | 'dark' | 'system'} theme
     */
    setTheme: (theme) => {
        localStorage.setItem(STORAGE_KEY, theme);
        applyTheme(theme);
        set({
            theme,
            resolvedTheme: theme === 'system' ? getSystemTheme() : theme,
        });
    },

    /**
     * 快速切換深淺色 / Quick toggle light ↔ dark
     */
    toggle: () => {
        const { resolvedTheme } = get();
        const next = resolvedTheme === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
    },
}));

// 監聽系統主題變更 / Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useThemeStore.getState();
    if (theme === 'system') {
        applyTheme('system');
        useThemeStore.setState({ resolvedTheme: getSystemTheme() });
    }
});

export default useThemeStore;
