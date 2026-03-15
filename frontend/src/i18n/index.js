/**
 * i18next 初始化設定 / i18next Initialization
 * 支援 10 種語言：zh-TW, en, ja, ko, vi, de, it, fil, id, hi
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
import zhTWWowClass from '../locales/zh-TW/wowClass.json';

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
import enWowClass from '../locales/en/wowClass.json';

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
import jaWowClass from '../locales/ja/wowClass.json';

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
import koWowClass from '../locales/ko/wowClass.json';

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
import viWowClass from '../locales/vi/wowClass.json';

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
import deWowClass from '../locales/de/wowClass.json';

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
import itWowClass from '../locales/it/wowClass.json';

// ── fil ──
import filCommon from '../locales/fil/common.json';
import filNav from '../locales/fil/nav.json';
import filDashboard from '../locales/fil/dashboard.json';
import filTasks from '../locales/fil/tasks.json';
import filTimetable from '../locales/fil/timetable.json';
import filGrades from '../locales/fil/grades.json';
import filTransport from '../locales/fil/transport.json';
import filLibrary from '../locales/fil/library.json';
import filSettings from '../locales/fil/settings.json';
import filWowClass from '../locales/fil/wowClass.json';

// ── id ──
import idCommon from '../locales/id/common.json';
import idNav from '../locales/id/nav.json';
import idDashboard from '../locales/id/dashboard.json';
import idTasks from '../locales/id/tasks.json';
import idTimetable from '../locales/id/timetable.json';
import idGrades from '../locales/id/grades.json';
import idTransport from '../locales/id/transport.json';
import idLibrary from '../locales/id/library.json';
import idSettings from '../locales/id/settings.json';
import idWowClass from '../locales/id/wowClass.json';

// ── hi ──
import hiCommon from '../locales/hi/common.json';
import hiNav from '../locales/hi/nav.json';
import hiDashboard from '../locales/hi/dashboard.json';
import hiTasks from '../locales/hi/tasks.json';
import hiTimetable from '../locales/hi/timetable.json';
import hiGrades from '../locales/hi/grades.json';
import hiTransport from '../locales/hi/transport.json';
import hiLibrary from '../locales/hi/library.json';
import hiSettings from '../locales/hi/settings.json';
import hiWowClass from '../locales/hi/wowClass.json';

const NAMESPACES = ['common', 'nav', 'dashboard', 'tasks', 'timetable', 'grades', 'transport', 'library', 'settings', 'wowClass'];

i18n
    .use(initReactI18next)
    .init({
        resources: {
            'zh-TW': { common: zhTWCommon, nav: zhTWNav, dashboard: zhTWDashboard, tasks: zhTWTasks, timetable: zhTWTimetable, grades: zhTWGrades, transport: zhTWTransport, library: zhTWLibrary, settings: zhTWSettings, wowClass: zhTWWowClass },
            'en':    { common: enCommon,   nav: enNav,   dashboard: enDashboard,   tasks: enTasks,   timetable: enTimetable,   grades: enGrades,   transport: enTransport,   library: enLibrary,   settings: enSettings,   wowClass: enWowClass   },
            'ja':    { common: jaCommon,   nav: jaNav,   dashboard: jaDashboard,   tasks: jaTasks,   timetable: jaTimetable,   grades: jaGrades,   transport: jaTransport,   library: jaLibrary,   settings: jaSettings,   wowClass: jaWowClass   },
            'ko':    { common: koCommon,   nav: koNav,   dashboard: koDashboard,   tasks: koTasks,   timetable: koTimetable,   grades: koGrades,   transport: koTransport,   library: koLibrary,   settings: koSettings,   wowClass: koWowClass   },
            'vi':    { common: viCommon,   nav: viNav,   dashboard: viDashboard,   tasks: viTasks,   timetable: viTimetable,   grades: viGrades,   transport: viTransport,   library: viLibrary,   settings: viSettings,   wowClass: viWowClass   },
            'de':    { common: deCommon,   nav: deNav,   dashboard: deDashboard,   tasks: deTasks,   timetable: deTimetable,   grades: deGrades,   transport: deTransport,   library: deLibrary,   settings: deSettings,   wowClass: deWowClass   },
            'it':    { common: itCommon,   nav: itNav,   dashboard: itDashboard,   tasks: itTasks,   timetable: itTimetable,   grades: itGrades,   transport: itTransport,   library: itLibrary,   settings: itSettings,   wowClass: itWowClass   },
            'fil':   { common: filCommon,  nav: filNav,  dashboard: filDashboard,  tasks: filTasks,  timetable: filTimetable,  grades: filGrades,  transport: filTransport,  library: filLibrary,  settings: filSettings,  wowClass: filWowClass  },
            'id':    { common: idCommon,   nav: idNav,   dashboard: idDashboard,   tasks: idTasks,   timetable: idTimetable,   grades: idGrades,   transport: idTransport,   library: idLibrary,   settings: idSettings,   wowClass: idWowClass   },
            'hi':    { common: hiCommon,   nav: hiNav,   dashboard: hiDashboard,   tasks: hiTasks,   timetable: hiTimetable,   grades: hiGrades,   transport: hiTransport,   library: hiLibrary,   settings: hiSettings,   wowClass: hiWowClass   },
        },
        lng: localStorage.getItem('piyou_lang') || 'zh-TW',
        fallbackLng: 'zh-TW',
        ns: NAMESPACES,
        defaultNS: 'common',
        interpolation: { escapeValue: false },
    });

export default i18n;
