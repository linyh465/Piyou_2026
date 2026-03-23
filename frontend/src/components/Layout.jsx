/**
 * 應用佈局外殼 / App Layout Shell — iOS 風格
 * 桌面版 (md+)：群組化側邊欄；行動版：底部兩層導航 + 滑動動畫
 */
import { useState, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import useTimetableStore from '../stores/timetableStore';
import {
    IconHome, IconCalendar, IconCheckSquare,
    IconSettings, IconChartBar, IconCloudLightning, IconCloudOff, IconBus,
    IconLibrary, IconArrowLeft, IconSchool, IconLink2
} from './Icons';
import NotificationPanel from './NotificationPanel';
import FeedbackModal from './FeedbackModal';

// ── 學校相關路徑 / School-related paths ──
const schoolPaths = ['/timetable', '/grades', '/library', '/transport'];

// 上次瀏覽的學校子頁面（預設課表）/ Last visited school sub-page (default: timetable)
// 模組層級變數，僅在事件處理器中更新 / Module-level variable, updated only in event handlers
let _lastSchoolPath = '/timetable';
let _touchStartX = 0;

// ── 側邊欄群組 / Sidebar Menu Groups ──（桌面版不變）
const menuGroups = [
    {
        label: '總覽',
        items: [
            { to: '/', icon: IconHome, label: '首頁', end: true },
            { to: '/tasks', icon: IconCheckSquare, label: '任務' },
        ],
    },
    {
        label: '校務',
        items: [
            { to: '/timetable', icon: IconCalendar, label: '課表' },
            { to: '/grades', icon: IconChartBar, label: '成績' },
        ],
    },
    {
        label: '生活',
        items: [
            { to: '/transport', icon: IconBus, label: '交通' },
            { to: '/library', icon: IconLibrary, label: '圖書館' },
            { to: '/share', icon: IconLink2, label: '共享' },
        ],
    },
];

// ── 行動版第一層導航 / Mobile Level 1 Nav ──
const mobileMainItems = [
    { to: '/settings', icon: IconSettings, label: '設定' },
    { to: '/tasks', icon: IconCheckSquare, label: '任務' },
    { to: '/', icon: IconHome, label: '首頁', end: true },
    { to: '/share', icon: IconLink2, label: '共享' },
    { key: 'school', icon: IconSchool, label: '學校', isCategory: true },
];

// ── 行動版第二層導航（學校）/ Mobile Level 2 Nav (School) ──
const mobileSchoolItems = [
    { to: '/grades', icon: IconChartBar, label: '成績' },
    { to: '/timetable', icon: IconCalendar, label: '課表' },
    { to: '/transport', icon: IconBus, label: '交通' },
    { to: '/library', icon: IconLibrary, label: '圖書館' },
    { key: 'back', icon: IconArrowLeft, label: '上一頁', isBack: true },
];

const SYNC_STEP_LABELS = { '課表': '同步課表…', '成績': '同步成績…', '圖書館': '同步圖書館…', '任務': '同步任務…', done: '✓ 同步完成', error: '同步失敗' };

export default function Layout() {
    const timetable = useTimetableStore((s) => s.timetable);
    const grades = useTimetableStore((s) => s.grades);
    const bgSyncStep = useTimetableStore((s) => s.bgSyncStep);
    const syncStatus = (timetable.length > 0 || grades.length > 0) ? 'synced' : 'error';

    const [showFeedback, setShowFeedback] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    // 導航層級：從路徑直接推導 / Navigation layer: derived from pathname
    const navLayer = useMemo(
        () => schoolPaths.some((p) => location.pathname.startsWith(p)) ? 'school' : 'main',
        [location.pathname]
    );

    // 進入學校前的路徑 / Path before entering school
    const [prevPath, setPrevPath] = useState('/');

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

    /** 渲染單個導航項 / Render a single nav item */
    const renderNavItem = (item) => {
        // 「學校」分類按鈕
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

        // 「上一頁」返回按鈕
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

        // 學校子頁面連結 — 點擊時記錄路徑 / School sub-page link — record path on click
        const isSchoolLink = item.to && schoolPaths.some((p) => item.to.startsWith(p));

        // 一般導航連結
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
                    {/* 同步狀態指示 / Sync Status */}
                    <div className="sidebar-sync-bar">
                        <div className="sidebar-sync-inner">
                            {syncStatus === 'synced' ? (
                                <IconCloudLightning size={14} className="sidebar-sync-icon-ok" />
                            ) : (
                                <IconCloudOff size={14} className="sidebar-sync-icon-err" />
                            )}
                            <span className="sidebar-sync-text">
                                {syncStatus === 'synced' ? '校務資料已同步' : '校務資料未同步'}
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
                        <span>系統設定</span>
                    </NavLink>
                </div>
            </aside>

            {/* ═══ 主要內容區 / Main Content ═══ */}
            <main className="sidebar-main">
                <Outlet />
            </main>

            {/* 背景同步進度條（樂觀 UI）/ Background sync progress bar */}
            {bgSyncStep && (
                <div style={{
                    position: 'fixed',
                    top: 'calc(env(safe-area-inset-top, 0px) + 0px)',
                    left: 0, right: 0,
                    zIndex: 400,
                    padding: '8px 16px',
                    background: bgSyncStep === 'done' ? 'var(--color-success)' : bgSyncStep === 'error' ? 'var(--color-danger)' : 'var(--color-brand)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 500,
                    textAlign: 'center',
                    transition: 'background 0.3s',
                }}>
                    {SYNC_STEP_LABELS[bgSyncStep] || '同步中…'}
                </div>
            )}

            {/* 通知鈴鐺（僅首頁）/ Notification bell (home only) */}
            {location.pathname === '/' && <NotificationPanel onOpenFeedback={() => setShowFeedback(true)} />}

            {/* 意見回饋 Modal */}
            <FeedbackModal show={showFeedback} onClose={() => setShowFeedback(false)} />

            {/* ═══ 行動版底部導航 / Mobile Bottom Nav — 兩層滑動導航 ═══ */}
            <nav className="mobile-bottom-nav"
                 onTouchStart={handleTouchStart}
                 onTouchEnd={handleTouchEnd}>
                <div className="mobile-nav-slider">
                    {/* 第一層：主導航 */}
                    <div className={`mobile-nav-layer ${navLayer === 'main' ? 'mobile-nav-layer--active' : 'mobile-nav-layer--left'}`}>
                        {mobileMainItems.map(renderNavItem)}
                    </div>
                    {/* 第二層：學校子導航 */}
                    <div className={`mobile-nav-layer ${navLayer === 'school' ? 'mobile-nav-layer--active' : 'mobile-nav-layer--right'}`}>
                        {mobileSchoolItems.map(renderNavItem)}
                    </div>
                </div>
            </nav>
        </div>
    );
}
