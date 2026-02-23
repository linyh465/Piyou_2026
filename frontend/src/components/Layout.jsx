/**
 * 應用佈局外殼 / App Layout Shell
 * 桌面版 (md+)：群組化暗色側邊欄；行動版：底部 Tab 導航
 * Desktop (md+): grouped dark sidebar; Mobile: bottom tab navigation.
 *
 * 側邊欄設計參考用戶提供之範本
 * Sidebar design based on user-provided template.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import useTimetableStore from '../stores/timetableStore';
import {
    IconHome, IconCalendar, IconCheckSquare,
    IconSettings, IconChartBar, IconCloudLightning, IconCloudOff, IconBus,
    IconBook
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
        ],
    },
];

// ── 「學習」子選單 / "Study" Sub-menu Items ──
const studySubItems = [
    { to: '/timetable', icon: IconCalendar, label: '課表' },
    { to: '/grades', icon: IconChartBar, label: '成績' },
    { to: '/tasks', icon: IconCheckSquare, label: '任務' },
];
const studyPaths = studySubItems.map((i) => i.to);

export default function Layout() {
    const timetable = useTimetableStore((s) => s.timetable);
    const grades = useTimetableStore((s) => s.grades);
    const syncStatus = (timetable.length > 0 || grades.length > 0) ? 'synced' : 'error';

    // ── 學習子選單狀態 / Study popover state ──
    const [studyOpen, setStudyOpen] = useState(false);
    const studyRef = useRef(null);
    const location = useLocation();
    const isStudyActive = studyPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));

    // 點擊外部關閉 / Close on outside click
    useEffect(() => {
        if (!studyOpen) return;
        const handler = (e) => {
            if (studyRef.current && !studyRef.current.contains(e.target)) {
                setStudyOpen(false);
            }
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, [studyOpen]);

    // 路由切換時關閉 / Close on navigation
    useEffect(() => { setStudyOpen(false); }, [location.pathname]);

    const handleStudyClick = useCallback(() => {
        setStudyOpen((prev) => !prev);
    }, []);

    return (
        <div className="sidebar-layout">

            {/* ═══ 桌面側邊欄 (md+) / Desktop Sidebar ═══ */}
            <aside className="sidebar">

                {/* 頂部品牌區 / Brand Header */}
                <div className="sidebar-brand">
                    <div className="sidebar-brand-inner">
                        <div className="sidebar-logo">P</div>
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

            {/* ═══ 行動版底部導航 / Mobile Bottom Nav ═══ */}
            <nav className="mobile-bottom-nav">
                <div className="mobile-bottom-nav-inner">
                    {/* 首頁 */}
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
                                    首頁
                                </span>
                            </>
                        )}
                    </NavLink>

                    {/* 學習（含彈出子選單） */}
                    <div className="mobile-nav-study-wrapper" ref={studyRef}>
                        {studyOpen && (
                            <div className="mobile-study-popover">
                                {studySubItems.map((sub) => (
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
                            className={`mobile-nav-item mobile-nav-btn ${isStudyActive ? 'active' : ''}`}
                            onClick={handleStudyClick}
                            aria-expanded={studyOpen}
                            aria-label="學習選單"
                        >
                            <IconBook size={22} />
                            <span className={`mobile-nav-label ${isStudyActive ? 'font-semibold' : ''}`}>
                                學習
                            </span>
                        </button>
                    </div>

                    {/* 交通 */}
                    <NavLink
                        to="/transport"
                        className={({ isActive }) =>
                            `mobile-nav-item ${isActive ? 'active' : ''}`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <IconBus size={22} />
                                <span className={`mobile-nav-label ${isActive ? 'font-semibold' : ''}`}>
                                    交通
                                </span>
                            </>
                        )}
                    </NavLink>
                </div>
            </nav>
        </div>
    );
}
