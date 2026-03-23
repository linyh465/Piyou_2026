/**
 * 主題狀態管理 / Theme Store
 * 管理深淺色模式切換 + 色彩主題切換，持久化至 localStorage
 * Manages light/dark mode toggle + color theme, persisted to localStorage.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'piyou_theme';
const COLOR_KEY = 'piyou_color_theme';

/** 可用色彩主題 / Available color themes */
export const COLOR_THEMES = [
    { id: 'default', label: '預設', labelEn: 'Default', description: '經典藍', color: '#007AFF' },
    { id: 'azure', label: '晴空', labelEn: 'Azure', description: '天藍澄澈', color: '#0A84FF' },
    { id: 'violet', label: '暮紫', labelEn: 'Violet', description: '幽蘭暮靄', color: '#8B5CF6' },
    { id: 'amber', label: '琥珀', labelEn: 'Amber', description: '暖陽流金', color: '#D97706' },
    { id: 'crimson', label: '緋紅', labelEn: 'Crimson', description: '丹霞映雪', color: '#DC2626' },
    { id: 'emerald', label: '翠柏', labelEn: 'Emerald', description: '蒼松斂翠', color: '#059669' },
    { id: 'rose', label: '薔薇', labelEn: 'Rose', description: '春庭薔薇', color: '#E11D48' },
    { id: 'wisteria', label: '紫藤', labelEn: 'Wisteria', description: '幽夢花期', color: '#C026D3' },
];

function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function applyColorTheme(colorTheme) {
    const el = document.documentElement;
    // Remove all theme-* classes first
    COLOR_THEMES.forEach((t) => {
        if (t.id !== 'default') el.classList.remove(`theme-${t.id}`);
    });
    // Apply new one
    if (colorTheme && colorTheme !== 'default') {
        el.classList.add(`theme-${colorTheme}`);
    }
}

// 初始化 / Initialize
const saved = localStorage.getItem(STORAGE_KEY) || 'system';
const savedColor = localStorage.getItem(COLOR_KEY) || 'default';
applyTheme(saved);
applyColorTheme(savedColor);

const useThemeStore = create((set, get) => ({
    /** 'light' | 'dark' | 'system' */
    theme: saved,

    /** 解析後的實際主題 / Resolved active theme */
    resolvedTheme: saved === 'system' ? getSystemTheme() : saved,

    /** 是否為深色模式 / Whether dark mode is active */
    isDarkMode: (saved === 'system' ? getSystemTheme() : saved) === 'dark',

    /** 色彩主題 / Color theme id */
    colorTheme: savedColor,

    /**
     * 設定主題 / Set theme
     * @param {'light' | 'dark' | 'system'} theme
     */
    setTheme: (theme) => {
        localStorage.setItem(STORAGE_KEY, theme);
        applyTheme(theme);
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        set({
            theme,
            resolvedTheme: resolved,
            isDarkMode: resolved === 'dark',
        });
    },

    /**
     * 設定色彩主題 / Set color theme
     * @param {string} colorTheme - one of COLOR_THEMES[].id
     */
    setColorTheme: (colorTheme) => {
        localStorage.setItem(COLOR_KEY, colorTheme);
        applyColorTheme(colorTheme);
        set({ colorTheme });
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
        const resolved = getSystemTheme();
        useThemeStore.setState({ resolvedTheme: resolved, isDarkMode: resolved === 'dark' });
    }
});

export default useThemeStore;
