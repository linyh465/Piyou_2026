/**
 * 應用佈局外殼 / App Layout Shell
 * 底部 Tab 導航：儀表板、課表、任務、AI 助理
 * Bottom tab navigation: Dashboard, Timetable, Tasks, AI Assistant.
 */
import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
    { to: '/', icon: '🏠', label: '儀表板', labelEn: 'Home' },
    { to: '/timetable', icon: '📅', label: '課表', labelEn: 'Schedule' },
    { to: '/tasks', icon: '✅', label: '任務', labelEn: 'Tasks' },
    { to: '/ai', icon: '🤖', label: 'AI 助理', labelEn: 'AI' },
];

export default function Layout() {
    return (
        <div className="flex flex-col h-full">
            {/* 頂部標題列 / Top header bar */}
            <header className="flex items-center justify-between px-5 py-3 glass-card rounded-none border-x-0 border-t-0"
                style={{ borderRadius: 0 }}>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🐾</span>
                    <h1 className="text-lg font-bold bg-gradient-to-r from-primary-light to-secondary bg-clip-text text-transparent">
                        披呦 Piyou
                    </h1>
                </div>
                <button className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm hover:bg-primary/40 transition-colors">
                    👤
                </button>
            </header>

            {/* 主要內容區 / Main content area */}
            <main className="flex-1 overflow-y-auto p-4 pb-24">
                <Outlet />
            </main>

            {/* 底部導航列 / Bottom navigation bar */}
            <nav className="fixed bottom-0 left-0 right-0 glass-card rounded-none border-x-0 border-b-0"
                style={{ borderRadius: '1rem 1rem 0 0' }}>
                <div className="flex justify-around items-center py-2 px-2">
                    {tabs.map((tab) => (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            end={tab.to === '/'}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-300 min-w-[60px] ${isActive
                                    ? 'bg-primary/20 text-primary-light scale-105'
                                    : 'text-text-muted hover:text-text-secondary'
                                }`
                            }
                        >
                            <span className="text-xl">{tab.icon}</span>
                            <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
