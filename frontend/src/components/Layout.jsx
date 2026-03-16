/**
 * 應用佈局外殼 / App Layout Shell — iOS 風格
 * 桌面版 (md+)：群組化側邊欄；行動版：底部兩層導航 + 滑動動畫
 */
import { useState, useMemo, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useTimetableStore from '../stores/timetableStore';
import {
    IconHome, IconCalendar, IconCheckSquare,
    IconSettings, IconChartBar, IconCloudLightning, IconCloudOff, IconBus,
    IconLibrary, IconArrowLeft, IconSchool,
} from './Icons';

// ── 學校相關路徑 / School-related paths ──
const schoolPaths = ['/timetable', '/grades', '/library'];

let _lastSchoolPath = '/timetable';
let _touchStartX = 0;

// ── 路由 → 翻譯 key 對應 / Route to nav translation key mapping ──
const ROUTE_TITLE_KEYS = {
    '/': 'home',
    '/tasks': 'tasks',
    '/timetable': 'timetable',
    '/grades': 'grades',
    '/transport': 'transport',
    '/library': 'library',
    '/settings': 'settings',
};

export default function Layout() {
    const { t } = useTranslation('nav');
    const timetable = useTimetableStore((s) => s.timetable);
    const grades = useTimetableStore((s) => s.grades);
    const syncStatus = (timetable.length > 0 || grades.length > 0) ? 'synced' : 'error';

    const location = useLocation();
    const navigate = useNavigate();

    const navLayer = useMemo(
        () => schoolPaths.some((p) => location.pathname.startsWith(p)) ? 'school' : 'main',
        [location.pathname]
    );

    const [prevPath, setPrevPath] = useState('/');

    // ── 動態 document.title / Dynamic document.title ──
    useEffect(() => {
        const key = ROUTE_TITLE_KEYS[location.pathname];
        const pageName = key ? t(key) : '';
        document.title = pageName ? `${pageName} · Piyou` : 'Piyou';
    }, [location.pathname, t]);

    // ── 側邊欄群組 / Sidebar Menu Groups ──
    const menuGroups = [
        {
            label: t('overview'),
            items: [
                { to: '/', icon: IconHome, label: t('home'), end: true },
                { to: '/tasks', icon: IconCheckSquare, label: t('tasks') },
            ],
        },
        {
            label: t('school'),
            items: [
                { to: '/timetable', icon: IconCalendar, label: t('timetable') },
                { to: '/grades', icon: IconChartBar, label: t('grades') },
            ],
        },
        {
            label: t('life'),
            items: [
                { to: '/transport', icon: IconBus, label: t('transport') },
                { to: '/library', icon: IconLibrary, label: t('library') },
            ],
        },
    ];

    // ── 行動版第一層導航 / Mobile Level 1 Nav ──
    const mobileMainItems = [
        { to: '/settings', icon: IconSettings, label: t('settings') },
        { to: '/tasks', icon: IconCheckSquare, label: t('tasks') },
        { to: '/', icon: IconHome, label: t('home'), end: true },
        { to: '/transport', icon: IconBus, label: t('transport') },
        { key: 'school', icon: IconSchool, label: t('schoolCategory'), isCategory: true },
    ];

    // ── 行動版第二層導航（學校）/ Mobile Level 2 Nav (School) ──
    const mobileSchoolItems = [
        { to: '/grades', icon: IconChartBar, label: t('grades') },
        { to: '/timetable', icon: IconCalendar, label: t('timetable') },
        { to: '/library', icon: IconLibrary, label: t('library') },
        { key: 'back', icon: IconArrowLeft, label: t('back'), isBack: true },
    ];

    const handleSchoolClick = () => {
        setPrevPath(location.pathname);
        navigate(_lastSchoolPath);
    };
    const handleBackClick = () => {
        navigate(prevPath);
    };

    const handleTouchStart = (e) => {
        _touchStartX = e.touches[0].clientX;
    };
    const handleTouchEnd = (e) => {
        const dx = e.changedTouches[0].clientX - _touchStartX;
        if (Math.abs(dx) < 50) return;
        if (dx < 0 && navLayer === 'main') {
            handleSchoolClick();
        } else if (dx > 0 && navLayer === 'school') {
            handleBackClick();
        }
    };

    const renderNavItem = (item) => {
        if (item.isCategory) {
            const isSchoolActive = schoolPaths.some((p) => location.pathname.startsWith(p));
            return (
                <button
                    key={item.key}
                    type="button"
                    className={`mobile-nav-item ${isSchoolActive ? 'active' : ''}`}
                    onClick={handleSchoolClick}
                >
                    <item.icon size={22} />
                    <span className={`mobile-nav-label ${isSchoolActive ? 'font-semibold' : ''}`}>
                        {item.label}
                    </span>
                </button>
            );
        }

        if (item.isBack) {
            return (
                <button
                    key={item.key}
                    type="button"
                    className="mobile-nav-item mobile-nav-back"
                    onClick={handleBackClick}
                >
                    <item.icon size={22} />
                    <span className="mobile-nav-label">{item.label}</span>
                </button>
            );
        }

        const isSchoolLink = item.to && schoolPaths.some((p) => item.to.startsWith(p));

        return (
            <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={isSchoolLink ? () => { _lastSchoolPath = item.to; } : undefined}
                className={({ isActive }) =>
                    `mobile-nav-item ${isActive ? 'active' : ''}`
                }
            >
                {({ isActive }) => (
                    <>
                        <item.icon size={22} />
                        <span className={`mobile-nav-label ${isActive ? 'font-semibold' : ''}`}>
                            {item.label}
                        </span>
                    </>
                )}
            </NavLink>
        );
    };

    return (
        <div className="sidebar-layout">

            {/* ═══ 桌面側邊欄 (md+) / Desktop Sidebar ═══ */}
            <aside className="sidebar">

                {/* 頂部品牌區 / Brand Header */}
                <div className="sidebar-brand">
                    <div className="sidebar-brand-inner">
                        <img src="/pwa-192x192.svg" alt="Piyou" className="sidebar-logo" />
                        <span className="sidebar-title">披呦</span>
                    </div>
                </div>

                {/* 導航選單區 / Navigation Groups */}
                <nav className="sidebar-nav">
                    {menuGroups.map((group, index) => (
                        <div key={index} className="sidebar-group">
                            <div className="sidebar-group-label">{group.label}</div>
                            <div className="sidebar-group-items">
                                {group.items.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        end={item.end}
                                        className={({ isActive }) =>
                                            `sidebar-nav-item ${isActive ? 'active' : ''}`
                                        }
                                    >
                                        <item.icon size={20} />
                                        <span>{item.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* 底部設定與狀態區 / Bottom Status & Settings */}
                <div className="sidebar-footer">
                    <div className="sidebar-sync-bar">
                        <div className="sidebar-sync-inner">
                            {syncStatus === 'synced' ? (
                                <IconCloudLightning size={14} className="sidebar-sync-icon-ok" />
                            ) : (
                                <IconCloudOff size={14} className="sidebar-sync-icon-err" />
                            )}
                            <span className="sidebar-sync-text">
                                {syncStatus === 'synced' ? t('syncedStatus') : t('notSyncedStatus')}
                            </span>
                        </div>
                    </div>

                    <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? 'active' : ''}`
                        }
                    >
                        <IconSettings size={20} />
                        <span>{t('settings')}</span>
                    </NavLink>
                </div>
            </aside>

            {/* ═══ 主要內容區 / Main Content ═══ */}
            <main className="sidebar-main">
                <Outlet />
            </main>

            {/* ═══ 行動版底部導航 / Mobile Bottom Nav ═══ */}
            <nav className="mobile-bottom-nav"
                 onTouchStart={handleTouchStart}
                 onTouchEnd={handleTouchEnd}>
                <div className="mobile-nav-slider">
                    <div className={`mobile-nav-layer ${navLayer === 'main' ? 'mobile-nav-layer--active' : 'mobile-nav-layer--left'}`}>
                        {mobileMainItems.map(renderNavItem)}
                    </div>
                    <div className={`mobile-nav-layer ${navLayer === 'school' ? 'mobile-nav-layer--active' : 'mobile-nav-layer--right'}`}>
                        {mobileSchoolItems.map(renderNavItem)}
                    </div>
                </div>
            </nav>
        </div>
    );
}
