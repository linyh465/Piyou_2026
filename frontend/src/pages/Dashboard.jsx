/**
 * 儀表板頁面 / Dashboard Page
 * 顯示「下一堂課」狀態卡片與 TDX 公車即時倒數
 * Shows "Next Class" status card and TDX bus real-time countdown.
 */
import { useEffect } from 'react';
import useDashboardStore from '../stores/dashboardStore';
import useTimetableStore from '../stores/timetableStore';

// ── 下一堂課卡片 / Next Class Card ──
function NextClassCard() {
    const getNextClass = useDashboardStore((s) => s.getNextClass);
    const fetchTimetable = useTimetableStore((s) => s.fetchTimetable);
    const isLoading = useTimetableStore((s) => s.isLoadingTimetable);

    useEffect(() => {
        fetchTimetable();
    }, [fetchTimetable]);

    const nextClass = getNextClass();

    if (isLoading) {
        return (
            <div className="glass-card p-5 animate-fade-in-up">
                <div className="skeleton h-4 w-24 mb-3" />
                <div className="skeleton h-6 w-48 mb-2" />
                <div className="skeleton h-4 w-32" />
            </div>
        );
    }

    if (!nextClass) {
        return (
            <div className="glass-card p-5 animate-fade-in-up">
                <p className="text-text-muted text-sm">📚 下一堂課 / Next Class</p>
                <p className="text-xl font-semibold mt-2 text-text-secondary">
                    今天沒有更多課程了 🎉
                </p>
                <p className="text-sm text-text-muted mt-1">No more classes today!</p>
            </div>
        );
    }

    return (
        <div className="glass-card glass-card-hover p-5 animate-fade-in-up">
            <p className="text-text-muted text-sm">📚 下一堂課 / Next Class</p>
            <h3 className="text-xl font-bold mt-2 text-text-primary">{nextClass.name}</h3>
            <div className="flex items-center gap-4 mt-3 text-sm text-text-secondary">
                <span>📍 {nextClass.location || '未指定 / TBD'}</span>
                <span>⏰ {nextClass.time || ''}</span>
            </div>
            {nextClass.minutesUntil !== null && (
                <div className="mt-3 inline-flex items-center gap-2 bg-primary/20 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-sm font-medium text-primary-light">
                        {nextClass.minutesUntil} 分鐘後開始 / starts in {nextClass.minutesUntil} min
                    </span>
                </div>
            )}
        </div>
    );
}

// ── 公車倒數卡片 / Bus Countdown Card ──
function BusCountdownCard() {
    const {
        busArrivals,
        isBusLoading,
        busError,
        busCountdown,
        startAutoRefresh,
        stopAutoRefresh,
    } = useDashboardStore();

    useEffect(() => {
        startAutoRefresh();
        return () => stopAutoRefresh();
    }, [startAutoRefresh, stopAutoRefresh]);

    const formatCountdown = (seconds) => {
        if (seconds === null || seconds === undefined) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="glass-card glass-card-hover p-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <p className="text-text-muted text-sm">🚌 公車即時倒數 / Bus Countdown</p>

            {isBusLoading && !busArrivals.length ? (
                <div className="mt-3 space-y-2">
                    <div className="skeleton h-10 w-full" />
                    <div className="skeleton h-4 w-3/4" />
                </div>
            ) : busError ? (
                <div className="mt-3 text-danger text-sm">
                    <p>⚠️ {busError}</p>
                    <p className="text-text-muted mt-1">使用模擬資料 / Using mock data</p>
                </div>
            ) : (
                <>
                    <div className="mt-3 flex items-end gap-3">
                        <span className="text-4xl font-mono font-bold text-secondary pulse-glow inline-block px-3 py-1 rounded-lg">
                            {formatCountdown(busCountdown)}
                        </span>
                        <span className="text-sm text-text-muted pb-1">
                            預估到站 / ETA
                        </span>
                    </div>

                    {busArrivals.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {busArrivals.slice(0, 3).map((bus, i) => (
                                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                                    <span className="flex items-center gap-2">
                                        <span className="bg-accent/20 text-accent px-2 py-0.5 rounded-md text-xs font-bold">
                                            {bus.routeName || `路線 ${i + 1}`}
                                        </span>
                                        <span className="text-text-secondary">{bus.direction || ''}</span>
                                    </span>
                                    <span className="text-text-primary font-medium">
                                        {bus.estimatedMinutes != null ? `${bus.estimatedMinutes} 分 / min` : '進站中'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── 快速入口 / Quick Access Grid ──
function QuickAccess() {
    const items = [
        { icon: '📊', label: '成績查詢', labelEn: 'Grades', path: '/grades' },
        { icon: '📝', label: '新增任務', labelEn: 'New Task', path: '/tasks?new=1' },
        { icon: '💬', label: '問 AI', labelEn: 'Ask AI', path: '/ai' },
        { icon: '📅', label: '週課表', labelEn: 'Weekly', path: '/timetable' },
    ];

    return (
        <div className="grid grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {items.map((item) => (
                <a
                    key={item.path}
                    href={`#${item.path}`}
                    className="glass-card glass-card-hover flex flex-col items-center gap-1.5 py-3 px-2 text-center"
                >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-[11px] text-text-secondary leading-tight">{item.label}</span>
                </a>
            ))}
        </div>
    );
}

// ── 主頁面 / Main Page ──
export default function Dashboard() {
    return (
        <div className="space-y-4">
            <NextClassCard />
            <BusCountdownCard />
            <QuickAccess />
        </div>
    );
}
