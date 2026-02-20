/**
 * 應用佈局外殼 / App Layout Shell
 * 桌面版 (md+)：群組化暗色側邊欄；行動版：底部 Tab 導航
 * Desktop (md+): grouped dark sidebar; Mobile: bottom tab navigation.
 *
 * 側邊欄設計參考用戶提供之範本
 * Sidebar design based on user-provided template.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useThemeStore from '../stores/themeStore';
import {
    IconHome, IconCalendar, IconCheckSquare, IconBot,
    IconSettings, IconChartBar, IconCloudLightning, IconCloudOff,
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
        ],
    },
];

// ── 行動版底部 Nav 項目 / Mobile Bottom Nav Items ──
const mobileNavItems = [
    { to: '/', icon: IconHome, label: '首頁', end: true },
    { to: '/timetable', icon: IconCalendar, label: '課表' },
    { to: '/tasks', icon: IconCheckSquare, label: '任務' },
    { to: '/ai', icon: IconBot, label: 'AI' },
];

export default function Layout() {
    const navigate = useNavigate();
    // 同步狀態：可之後接到真實邏輯 / Sync status: can wire to real logic later
    const syncStatus = 'synced'; // 'synced' | 'error'

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

                    {/* AI 助理獨立區塊 / AI Assistant Section */}
                    <div className="sidebar-ai-section">
                        <NavLink
                            to="/ai"
                            className={({ isActive }) =>
                                `sidebar-ai-btn ${isActive ? 'active' : ''}`
                            }
                        >
                            <div className="sidebar-ai-btn-inner">
                                <IconBot size={20} />
                                <span>AI 助理</span>
                            </div>
                            <div className="sidebar-ai-pulse" />
                        </NavLink>
                    </div>
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
                                {syncStatus === 'synced' ? '校務資料已同步' : '憑證失效，請重新登入'}
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
                    {mobileNavItems.map((tab) => (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            end={tab.end}
                            className={({ isActive }) =>
                                `mobile-nav-item ${isActive ? 'active' : ''}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <tab.icon size={22} />
                                    <span className={`mobile-nav-label ${isActive ? 'font-semibold' : ''}`}>
                                        {tab.label}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
