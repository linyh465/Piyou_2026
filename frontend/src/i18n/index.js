/**
 * i18next 初始化設定 / i18next Initialization
 * 支援 2 種語言：zh-TW, en
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ── zh-TW ──
import zhTWCommon from '../locales/zh-TW/common.json';
import zhTWNav from '../locales/zh-TW/nav.json';
import zhTWDashboard from '../locales/zh-TW/dashboard.json';
import zhTWTasks from '../locales/zh-TW/tasks.json';
import zhTWTimetable from '../locales/zh-TW/timetable.json';
import zhTWGrades from '../locales/zh-TW/grades.json';
import zhTWTransport from '../locales/zh-TW/transport.json';
import zhTWLibrary from '../locales/zh-TW/library.json';
import zhTWSettings from '../locales/zh-TW/settings.json';

// ── en ──
import enCommon from '../locales/en/common.json';
import enNav from '../locales/en/nav.json';
import enDashboard from '../locales/en/dashboard.json';
import enTasks from '../locales/en/tasks.json';
import enTimetable from '../locales/en/timetable.json';
import enGrades from '../locales/en/grades.json';
import enTransport from '../locales/en/transport.json';
import enLibrary from '../locales/en/library.json';
import enSettings from '../locales/en/settings.json';

const NAMESPACES = ['common', 'nav', 'dashboard', 'tasks', 'timetable', 'grades', 'transport', 'library', 'settings'];

i18n
    .use(initReactI18next)
    .init({
        resources: {
            'zh-TW': { common: zhTWCommon, nav: zhTWNav, dashboard: zhTWDashboard, tasks: zhTWTasks, timetable: zhTWTimetable, grades: zhTWGrades, transport: zhTWTransport, library: zhTWLibrary, settings: zhTWSettings },
            'en':    { common: enCommon,   nav: enNav,   dashboard: enDashboard,   tasks: enTasks,   timetable: enTimetable,   grades: enGrades,   transport: enTransport,   library: enLibrary,   settings: enSettings   },
        },
        lng: localStorage.getItem('piyou_lang') || 'zh-TW',
        fallbackLng: 'zh-TW',
        ns: NAMESPACES,
        defaultNS: 'common',
        interpolation: { escapeValue: false },
    });

export default i18n;
