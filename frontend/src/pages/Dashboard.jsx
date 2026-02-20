/**
 * 儀表板頁面 / Dashboard Page
 * 間距參考 Dcard / Instagram / YouTube
 * Spacing inspired by Dcard / Instagram / YouTube layouts.
 */
import { useEffect } from 'react';
import useDashboardStore from '../stores/dashboardStore';
import useTimetableStore from '../stores/timetableStore';
import { busRoutes } from '../data/transportData';
import {
    IconBook, IconMapPin, IconClock, IconBus,
    IconChartBar, IconPlus, IconBot, IconCalendar,
} from '../components/Icons';

// ── 問候語 / Greeting ──
function Greeting() {
    const hour = new Date().getHours();
    let greeting = '早安';
    if (hour >= 12 && hour < 18) greeting = '午安';
    else if (hour >= 18) greeting = '晚安';

    const dateStr = new Date().toLocaleDateString('zh-TW', {
        month: 'long', day: 'numeric', weekday: 'long',
    });

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '4px' }}>
            <h2 style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {greeting} 👋
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>{dateStr}</p>
        </div>
    );
}

// ── 下一堂課卡片 / Next Class Card ──
function NextClassCard() {
    const getNextClass = useDashboardStore((s) => s.getNextClass);
    const fetchTimetable = useTimetableStore((s) => s.fetchTimetable);
    const isLoading = useTimetableStore((s) => s.isLoadingTimetable);

    useEffect(() => { fetchTimetable(); }, [fetchTimetable]);
    const nextClass = getNextClass();

    if (isLoading) {
        return (
            <div className="card animate-fade-in">
                <div className="skeleton" style={{ height: '16px', width: '96px', marginBottom: '16px' }} />
                <div className="skeleton" style={{ height: '24px', width: '192px', marginBottom: '12px' }} />
                <div className="skeleton" style={{ height: '16px', width: '128px' }} />
            </div>
        );
    }

    if (!nextClass) {
        return (
            <div className="card animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <IconBook size={16} />
                    <span style={{ fontSize: '13px' }}>下一堂課 Next Class</span>
                </div>
                <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    今天沒有更多課程了 🎉
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>No more classes today!</p>
            </div>
        );
    }

    return (
        <div className="card card-hover animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                <IconBook size={16} />
                <span style={{ fontSize: '13px' }}>下一堂課 Next Class</span>
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)' }}>{nextClass.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconMapPin size={14} /> {nextClass.location || '未指定 TBD'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconClock size={14} /> {nextClass.time || ''}
                </span>
            </div>
            {nextClass.minutesUntil !== null && (
                <div style={{ marginTop: '14px' }}>
                    <span className="badge" style={{ background: 'var(--color-brand-subtle)', color: 'var(--color-brand)' }}>
                        {nextClass.minutesUntil} 分鐘後 in {nextClass.minutesUntil} min
                    </span>
                </div>
            )}
        </div>
    );
}

// ── 公車動態卡片 / Bus Dynamics Card ──
function BusCountdownCard() {
    const { busArrivals, isBusLoading, busError, startAutoRefresh, stopAutoRefresh } = useDashboardStore();

    useEffect(() => { startAutoRefresh(); return () => stopAutoRefresh(); }, [startAutoRefresh, stopAutoRefresh]);

    // 從 transportData 的路線資訊中找到對應的說明
    const getRouteDesc = (routeName) => {
        const route = busRoutes.find((r) => routeName && routeName.includes(r.name));
        return route ? route.description : '';
    };

    // 取前 3 筆最近到站的資料
    const topArrivals = busArrivals.slice(0, 3);

    return (
        <div className="card card-hover animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                    <IconBus size={16} />
                    <span style={{ fontSize: '13px' }}>公車動態 Bus Status</span>
                </div>
                <a
                    href="#/transport"
                    style={{
                        fontSize: '12px', color: 'var(--color-brand)', textDecoration: 'none',
                        display: 'flex', alignItems: 'center', gap: '2px',
                    }}
                >
                    查看更多 →
                </a>
            </div>

            {isBusLoading && !busArrivals.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="skeleton" style={{ height: '40px', width: '100%' }} />
                    <div className="skeleton" style={{ height: '16px', width: '75%' }} />
                </div>
            ) : busError ? (
                <div>
                    <p style={{ fontSize: '14px', color: 'var(--color-danger)' }}>{busError}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>使用模擬資料 Using mock data</p>
                </div>
            ) : topArrivals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {topArrivals.map((bus, i) => {
                        const desc = getRouteDesc(bus.routeName);
                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    fontSize: '14px', padding: '10px 8px', borderRadius: '10px',
                                    borderBottom: i < topArrivals.length - 1 ? '1px solid var(--border-light)' : 'none',
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                    <span className="badge" style={{
                                        background: 'var(--color-brand-subtle)', color: 'var(--color-brand)',
                                        fontWeight: 700, flexShrink: 0,
                                    }}>
                                        {bus.routeName || `#${i + 1}`}
                                    </span>
                                    <span style={{
                                        color: 'var(--text-secondary)', fontSize: '13px',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {desc || bus.direction || ''}
                                    </span>
                                </span>
                                <span style={{ fontWeight: 600, color: 'var(--text)', flexShrink: 0, marginLeft: '8px' }}>
                                    {bus.estimatedMinutes != null ? `${bus.estimatedMinutes} min` : '進站中'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                    目前無公車資訊 No bus data
                </p>
            )}
        </div>
    );
}


// ── 快速入口 / Quick Access Grid ──
function QuickAccess() {
    const items = [
        { icon: IconChartBar, label: '成績查詢', path: '/grades' },
        { icon: IconPlus, label: '新增任務', path: '/tasks?new=1' },
        { icon: IconBot, label: '問 AI', path: '/ai' },
        { icon: IconCalendar, label: '週課表', path: '/timetable' },
    ];

    return (
        <div
            className="animate-fade-in"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', animationDelay: '0.15s' }}
        >
            {items.map((item) => (
                <a
                    key={item.path}
                    href={`#${item.path}`}
                    className="card card-hover"
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: '8px', padding: '16px 8px', textDecoration: 'none', textAlign: 'center',
                    }}
                >
                    <item.icon size={22} style={{ color: 'var(--color-brand)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {item.label}
                    </span>
                </a>
            ))}
        </div>
    );
}

// ── 主頁面 / Main Page ──
export default function Dashboard() {
    return (
        <div className="section-stack">
            <Greeting />
            <div className="grid-responsive-2" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-card-gap)' }}>
                <NextClassCard />
                <BusCountdownCard />
            </div>
            <QuickAccess />
        </div>
    );
}
