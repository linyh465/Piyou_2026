/**
 * 儀表板頁面 / Dashboard Page
 * 穩定無閃爍版本 — 初始使用 localStorage 快取資料渲染
 * Stable no-flicker version — renders cached data from localStorage on first paint.
 */
import { useEffect, useRef } from 'react';
import useDashboardStore from '../stores/dashboardStore';
import useTimetableStore from '../stores/timetableStore';
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
        <div style={{ paddingBottom: '4px' }}>
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
    const timetable = useTimetableStore((s) => s.timetable);
    const isLoading = useTimetableStore((s) => s.isLoadingTimetable);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!hasFetched.current) { hasFetched.current = true; fetchTimetable(); }
    }, [fetchTimetable]);

    const nextClass = getNextClass();

    // 只在完全無資料且正在第一次載入時顯示骨架屏
    if (isLoading && !timetable.length) {
        return (
            <div className="card">
                <div className="skeleton" style={{ height: '16px', width: '96px', marginBottom: '16px' }} />
                <div className="skeleton" style={{ height: '24px', width: '192px', marginBottom: '12px' }} />
                <div className="skeleton" style={{ height: '16px', width: '128px' }} />
            </div>
        );
    }

    if (!nextClass) {
        return (
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <IconBook size={16} />
                    <span style={{ fontSize: '13px' }}>下一堂課</span>
                </div>
                <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    今天沒有更多課程了 🎉
                </p>
            </div>
        );
    }

    return (
        <div className="card card-hover">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                <IconBook size={16} />
                <span style={{ fontSize: '13px' }}>下一堂課</span>
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)' }}>{nextClass.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconMapPin size={14} /> {nextClass.location || '未指定'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconClock size={14} /> {nextClass.time || ''}
                </span>
            </div>
            {nextClass.minutesUntil !== null && (
                <div style={{ marginTop: '14px' }}>
                    <span className="badge" style={{ background: 'var(--color-brand-subtle)', color: 'var(--color-brand)' }}>
                        {nextClass.minutesUntil} 分鐘後上課
                    </span>
                </div>
            )}
        </div>
    );
}


// ── 快速入口 / Quick Access Grid ──
function QuickAccess() {
    const items = [
        { icon: IconChartBar, label: '成績查詢', path: '/grades' },
        { icon: IconCalendar, label: '週課表', path: '/timetable' },
        { icon: IconBus, label: '交通', path: '/transport' },
        { icon: IconBot, label: 'AI 助理', path: '/ai' },
    ];

    return (
        <div className="dash-quick-grid">
            {items.map((item) => (
                <a key={item.path} href={`#${item.path}`} className="card card-hover dash-quick-item">
                    <item.icon size={22} style={{ color: 'var(--color-brand)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
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
        <div className="section-stack dash-page">
            <Greeting />
            <div className="dash-cards-grid">
                <NextClassCard />
            </div>
            <QuickAccess />
        </div>
    );
}
