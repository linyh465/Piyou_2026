/**
 * 語言偏好狀態管理 / Language Preference Store
 * 管理目前選取語言並同步至 localStorage
 */
import { create } from 'zustand';
import i18n from '../i18n/index';

export const LANGUAGES = [
    { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
    { code: 'en',    label: 'English',   flag: '🇺🇸' },
    { code: 'ja',    label: '日本語',    flag: '🇯🇵' },
    { code: 'ko',    label: '한국어',    flag: '🇰🇷' },
    { code: 'vi',    label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'de',    label: 'Deutsch',   flag: '🇩🇪' },
    { code: 'it',    label: 'Italiano',  flag: '🇮🇹' },
];

const useLangStore = create((set) => ({
    lang: localStorage.getItem('piyou_lang') || 'zh-TW',

    setLang: (code) => {
        localStorage.setItem('piyou_lang', code);
        i18n.changeLanguage(code);
        set({ lang: code });
    },
}));

export default useLangStore;
