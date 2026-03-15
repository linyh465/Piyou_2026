/**
 * i18next 初始化設定 / i18next Initialization
 * 支援 7 種語言：zh-TW, en, ja, ko, vi, de, it
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

// ── ja ──
import jaCommon from '../locales/ja/common.json';
import jaNav from '../locales/ja/nav.json';
import jaDashboard from '../locales/ja/dashboard.json';
import jaTasks from '../locales/ja/tasks.json';
import jaTimetable from '../locales/ja/timetable.json';
import jaGrades from '../locales/ja/grades.json';
import jaTransport from '../locales/ja/transport.json';
import jaLibrary from '../locales/ja/library.json';
import jaSettings from '../locales/ja/settings.json';

// ── ko ──
import koCommon from '../locales/ko/common.json';
import koNav from '../locales/ko/nav.json';
import koDashboard from '../locales/ko/dashboard.json';
import koTasks from '../locales/ko/tasks.json';
import koTimetable from '../locales/ko/timetable.json';
import koGrades from '../locales/ko/grades.json';
import koTransport from '../locales/ko/transport.json';
import koLibrary from '../locales/ko/library.json';
import koSettings from '../locales/ko/settings.json';

// ── vi ──
import viCommon from '../locales/vi/common.json';
import viNav from '../locales/vi/nav.json';
import viDashboard from '../locales/vi/dashboard.json';
import viTasks from '../locales/vi/tasks.json';
import viTimetable from '../locales/vi/timetable.json';
import viGrades from '../locales/vi/grades.json';
import viTransport from '../locales/vi/transport.json';
import viLibrary from '../locales/vi/library.json';
import viSettings from '../locales/vi/settings.json';

// ── de ──
import deCommon from '../locales/de/common.json';
import deNav from '../locales/de/nav.json';
import deDashboard from '../locales/de/dashboard.json';
import deTasks from '../locales/de/tasks.json';
import deTimetable from '../locales/de/timetable.json';
import deGrades from '../locales/de/grades.json';
import deTransport from '../locales/de/transport.json';
import deLibrary from '../locales/de/library.json';
import deSettings from '../locales/de/settings.json';

// ── it ──
import itCommon from '../locales/it/common.json';
import itNav from '../locales/it/nav.json';
import itDashboard from '../locales/it/dashboard.json';
import itTasks from '../locales/it/tasks.json';
import itTimetable from '../locales/it/timetable.json';
import itGrades from '../locales/it/grades.json';
import itTransport from '../locales/it/transport.json';
import itLibrary from '../locales/it/library.json';
import itSettings from '../locales/it/settings.json';

const NAMESPACES = ['common', 'nav', 'dashboard', 'tasks', 'timetable', 'grades', 'transport', 'library', 'settings'];

i18n
    .use(initReactI18next)
    .init({
        resources: {
            'zh-TW': { common: zhTWCommon, nav: zhTWNav, dashboard: zhTWDashboard, tasks: zhTWTasks, timetable: zhTWTimetable, grades: zhTWGrades, transport: zhTWTransport, library: zhTWLibrary, settings: zhTWSettings },
            'en':    { common: enCommon,   nav: enNav,   dashboard: enDashboard,   tasks: enTasks,   timetable: enTimetable,   grades: enGrades,   transport: enTransport,   library: enLibrary,   settings: enSettings   },
            'ja':    { common: jaCommon,   nav: jaNav,   dashboard: jaDashboard,   tasks: jaTasks,   timetable: jaTimetable,   grades: jaGrades,   transport: jaTransport,   library: jaLibrary,   settings: jaSettings   },
            'ko':    { common: koCommon,   nav: koNav,   dashboard: koDashboard,   tasks: koTasks,   timetable: koTimetable,   grades: koGrades,   transport: koTransport,   library: koLibrary,   settings: koSettings   },
            'vi':    { common: viCommon,   nav: viNav,   dashboard: viDashboard,   tasks: viTasks,   timetable: viTimetable,   grades: viGrades,   transport: viTransport,   library: viLibrary,   settings: viSettings   },
            'de':    { common: deCommon,   nav: deNav,   dashboard: deDashboard,   tasks: deTasks,   timetable: deTimetable,   grades: deGrades,   transport: deTransport,   library: deLibrary,   settings: deSettings   },
            'it':    { common: itCommon,   nav: itNav,   dashboard: itDashboard,   tasks: itTasks,   timetable: itTimetable,   grades: itGrades,   transport: itTransport,   library: itLibrary,   settings: itSettings   },
        },
        lng: localStorage.getItem('piyou_lang') || 'zh-TW',
        fallbackLng: 'zh-TW',
        ns: NAMESPACES,
        defaultNS: 'common',
        interpolation: { escapeValue: false },
    });

export default i18n;
