/**
 * 應用佈局外殼 / App Layout Shell
 * 行動版：底部 Tab 導航；桌面版 (md+)：側邊欄導航
 * Mobile: bottom tab nav; Desktop (md+): sidebar navigation.
 *
 * 間距參考 Instagram / YouTube / Dcard 排版
 * Spacing inspired by Instagram / YouTube / Dcard layouts.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useThemeStore from '../stores/themeStore';
import {
    IconHome, IconCalendar, IconCheckSquare, IconBot,
    IconSun, IconMoon, IconBell, IconUser, IconSettings,
    IconChartBar,
} from './Icons';

// ── 導航項目 / Navigation Items ──
const navItems = [
    { to: '/', icon: IconHome, label: '首頁' },
    { to: '/timetable', icon: IconCalendar, label: '課表' },
    { to: '/tasks', icon: IconCheckSquare, label: '任務' },
    { to: '/ai', icon: IconBot, label: 'AI' },
];

export default function Layout() {
    const { resolvedTheme, toggle } = useThemeStore();
    const navigate = useNavigate();
    const isDark = resolvedTheme === 'dark';

    return (
        <div className="app-shell">
            {/* ═══ 頂部標題列 / Top Header ═══
                高度 56px — 與 YouTube / Dcard 一致 */}
            <header
                className="app-header"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '56px',
                    padding: '0 20px',
                    background: 'var(--bg-nav)',
                    borderBottom: '1px solid var(--border)',
                    backdropFilter: 'blur(16px)',
                }}
            >
                {/* 左：Logo + 標題 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                        style={{
                            width: '36px', height: '36px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--color-brand)', color: 'white',
                            fontWeight: 700, fontSize: '15px',
                        }}
                    >
                        P
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                        披呦
                    </span>
                </div>

                {/* 右：Action Icons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                        onClick={toggle}
                        title={isDark ? '淺色 Light' : '深色 Dark'}
                        style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
                    </button>

                    <button
                        title="通知 Notifications"
                        style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--text-secondary)', position: 'relative',
                        }}
                    >
                        <IconBell size={20} />
                        <span style={{
                            position: 'absolute', top: '8px', right: '8px',
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: 'var(--color-danger)',
                        }} />
                    </button>

                    <button
                        onClick={() => navigate('/settings')}
                        title="設定 Settings"
                        style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--color-brand)', color: 'white',
                            border: 'none', cursor: 'pointer', marginLeft: '4px',
                        }}
                    >
                        <IconUser size={18} />
                    </button>
                </div>
            </header>

            {/* ═══ 桌面側邊欄 (md+) / Desktop Sidebar ═══ */}
            <aside
                className="app-sidebar"
                style={{
                    display: 'none', flexDirection: 'column',
                    padding: '20px 16px',
                    background: 'var(--bg-card)', borderRight: '1px solid var(--border)',
                }}
            >
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: '14px',
                                padding: '12px 16px', borderRadius: '14px',
                                fontSize: '14px', fontWeight: 500,
                                textDecoration: 'none',
                                color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
                                background: isActive ? 'var(--color-brand-subtle)' : 'transparent',
                                transition: 'all 0.15s ease',
                            })}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}

                    <NavLink
                        to="/grades"
                        style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '12px 16px', borderRadius: '14px',
                            fontSize: '14px', fontWeight: 500,
                            textDecoration: 'none',
                            color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
                            background: isActive ? 'var(--color-brand-subtle)' : 'transparent',
                            transition: 'all 0.15s ease',
                        })}
                    >
                        <IconChartBar size={20} />
                        <span>成績</span>
                    </NavLink>
                </nav>

                <NavLink
                    to="/settings"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '12px 16px', borderRadius: '14px',
                        fontSize: '14px', fontWeight: 500,
                        textDecoration: 'none',
                        color: 'var(--text-secondary)',
                        marginTop: 'auto',
                        transition: 'all 0.15s ease',
                    }}
                >
                    <IconSettings size={20} />
                    <span>設定</span>
                </NavLink>
            </aside>

            {/* ═══ 主要內容區 / Main Content ═══
                padding 使用 CSS token，底部預留 88px 給 bottom nav */}
            <main
                className="app-main"
                style={{
                    flex: 1, overflowY: 'auto',
                    padding: 'var(--space-page)',
                    paddingBottom: '88px',
                    background: 'var(--bg)',
                }}
            >
                <Outlet />
            </main>

            {/* ═══ 底部導航 / Bottom Nav ═══
                高度 64px（含 safe-area）— 接近 IG 底部 Bar */}
            <nav
                className="app-bottom-nav"
                style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    background: 'var(--bg-nav)',
                    borderTop: '1px solid var(--border)',
                    backdropFilter: 'blur(16px)',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                <div style={{
                    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                    height: '56px', padding: '0 8px',
                }}>
                    {navItems.map((tab) => (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            end={tab.to === '/'}
                            style={({ isActive }) => ({
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                gap: '4px',
                                padding: '6px 16px',
                                borderRadius: '14px',
                                minWidth: '64px',
                                textDecoration: 'none',
                                color: isActive ? 'var(--color-brand)' : 'var(--text-muted)',
                                transition: 'color 0.15s ease',
                            })}
                        >
                            {({ isActive }) => (
                                <>
                                    <tab.icon size={22} />
                                    <span style={{
                                        fontSize: '10px', fontWeight: isActive ? 600 : 500,
                                        lineHeight: 1,
                                    }}>
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
