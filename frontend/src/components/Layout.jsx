/**
 * 應用佈局外殼 / App Layout Shell — iOS 風格
 * 桌面版 (md+)：群組化側邊欄；行動版：底部 4-Tab 導航
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import useTimetableStore from '../stores/timetableStore';
import {
    IconHome, IconCalendar, IconCheckSquare,
    IconSettings, IconChartBar, IconCloudLightning, IconCloudOff, IconBus,
    IconBook, IconLibrary, IconUser
} from './Icons';

// ── 側邊欄群組 / Sidebar Menu Groups ──
const menuGroups = [
    {
        label: '總覽',
        items: [
            { to: '/', icon: IconHome, label: '首頁', end: true },
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
            { to: '/tasks', icon: IconCheckSquare, label: '任務' },
            { to: '/transport', icon: IconBus, label: '交通' },
            { to: '/library', icon: IconLibrary, label: '圖書館' },
        ],
    },
];

// ── 「更多」子選單項 / "More" Sub-menu Items ──
const moreSubItems = [
    { to: '/tasks', icon: IconCheckSquare, label: '任務' },
    { to: '/transport', icon: IconBus, label: '交通' },
    { to: '/library', icon: IconLibrary, label: '圖書館' },
    { to: '/settings', icon: IconSettings, label: '設定' },
];
const morePaths = moreSubItems.map((i) => i.to);

export default function Layout() {
    const timetable = useTimetableStore((s) => s.timetable);
    const grades = useTimetableStore((s) => s.grades);
    const syncStatus = (timetable.length > 0 || grades.length > 0) ? 'synced' : 'error';

    // ── 更多子選單狀態 / More popover state ──
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef(null);
    const location = useLocation();
    const isMoreActive = morePaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));

    const [prevPathname, setPrevPathname] = useState(location.pathname);
    if (prevPathname !== location.pathname) {
        setPrevPathname(location.pathname);
        setMoreOpen(false);
    }

    useEffect(() => {
        if (!moreOpen) return;
        const handler = (e) => {
            if (moreRef.current && !moreRef.current.contains(e.target)) {
                setMoreOpen(false);
            }
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, [moreOpen]);

    const handleMoreClick = useCallback(() => {
        setMoreOpen((prev) => !prev);
    }, []);

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

            {/* ═══ 行動版底部導航 / Mobile Bottom Nav — 4 Tab iOS 風格 ═══ */}
            <nav className="mobile-bottom-nav">
                <div className="mobile-bottom-nav-inner">
                    {/* 今天 */}
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            `mobile-nav-item ${isActive ? 'active' : ''}`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <IconHome size={22} />
                                <span className={`mobile-nav-label ${isActive ? 'font-semibold' : ''}`}>
                                    今天
                                </span>
                            </>
                        )}
                    </NavLink>

                    {/* 課表 */}
                    <NavLink
                        to="/timetable"
                        className={({ isActive }) =>
                            `mobile-nav-item ${isActive ? 'active' : ''}`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <IconCalendar size={22} />
                                <span className={`mobile-nav-label ${isActive ? 'font-semibold' : ''}`}>
                                    課表
                                </span>
                            </>
                        )}
                    </NavLink>

                    {/* 成績 */}
                    <NavLink
                        to="/grades"
                        className={({ isActive }) =>
                            `mobile-nav-item ${isActive ? 'active' : ''}`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <IconChartBar size={22} />
                                <span className={`mobile-nav-label ${isActive ? 'font-semibold' : ''}`}>
                                    成績
                                </span>
                            </>
                        )}
                    </NavLink>

                    {/* 更多（含彈出子選單） */}
                    <div className="mobile-nav-study-wrapper" ref={moreRef}>
                        {moreOpen && (
                            <div className="mobile-study-popover">
                                {moreSubItems.map((sub) => (
                                    <NavLink
                                        key={sub.to}
                                        to={sub.to}
                                        className={({ isActive }) =>
                                            `mobile-study-popover-item ${isActive ? 'active' : ''}`
                                        }
                                    >
                                        <sub.icon size={20} />
                                        <span>{sub.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        )}
                        <button
                            type="button"
                            className={`mobile-nav-item mobile-nav-btn ${isMoreActive ? 'active' : ''}`}
                            onClick={handleMoreClick}
                            aria-expanded={moreOpen}
                            aria-label="更多選單"
                        >
                            <IconUser size={22} />
                            <span className={`mobile-nav-label ${isMoreActive ? 'font-semibold' : ''}`}>
                                更多
                            </span>
                        </button>
                    </div>
                </div>
            </nav>
        </div>
    );
}
