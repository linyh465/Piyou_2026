/**
 * 儀表板頁面 / Dashboard Page
 * 穩定無閃爍版本 — 初始使用 localStorage 快取資料渲染
 * Stable no-flicker version — renders cached data from localStorage on first paint.
 */
import { useEffect, useRef } from 'react';
import useDashboardStore from '../stores/dashboardStore';
import useTimetableStore from '../stores/timetableStore';
import useTaskStore from '../stores/taskStore';
import {
    IconBook, IconMapPin, IconClock,
    IconCheckSquare, IconCalendar, IconStar, IconPlus,
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


// ── 任務預覽卡片 / Task Preview Card ──
function TaskPreviewCard() {
    const loadTasks = useTaskStore((s) => s.loadTasks);
    const tasks = useTaskStore((s) => s.tasks);
    const isLoading = useTaskStore((s) => s.isLoading);
    const toggleTask = useTaskStore((s) => s.toggleTask);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!hasFetched.current) { hasFetched.current = true; loadTasks(); }
    }, [loadTasks]);

    const pendingTasks = tasks.filter((t) => !t.completed).slice(0, 4);
    const completedCount = tasks.filter((t) => t.completed).length;

    // 骨架屏
    if (isLoading && !tasks.length) {
        return (
            <div className="card">
                <div className="skeleton" style={{ height: '16px', width: '96px', marginBottom: '16px' }} />
                <div className="skeleton" style={{ height: '20px', width: '160px', marginBottom: '10px' }} />
                <div className="skeleton" style={{ height: '16px', width: '128px' }} />
            </div>
        );
    }

    if (!pendingTasks.length) {
        return (
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <IconCheckSquare size={16} />
                    <span style={{ fontSize: '13px' }}>待辦任務</span>
                </div>
                <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    所有任務已完成 🎉
                </p>
                {tasks.length > 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        已完成 {completedCount} 項任務
                    </p>
                )}
                <a href="#/tasks" className="btn btn-soft" style={{ marginTop: '14px', fontSize: '13px', gap: '6px' }}>
                    <IconPlus size={14} /> 新增任務
                </a>
            </div>
        );
    }

    return (
        <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                    <IconCheckSquare size={16} />
                    <span style={{ fontSize: '13px' }}>待辦任務</span>
                </div>
                <a href="#/tasks" style={{ fontSize: '12px', color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 500 }}>
                    查看全部
                </a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingTasks.map((task) => (
                    <div
                        key={task.id}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border-light)',
                        }}
                    >
                        <button
                            onClick={() => toggleTask(task.id)}
                            style={{
                                width: '20px', height: '20px', borderRadius: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, cursor: 'pointer',
                                border: '2px solid var(--border)', background: 'transparent',
                                color: 'transparent',
                            }}
                            aria-label="完成任務"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                                fontSize: '13px', fontWeight: 500, color: 'var(--text)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {task.title}
                            </p>
                            {task.due_date && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <IconCalendar size={10} style={{ color: 'var(--color-warning)' }} />
                                    <span style={{ fontSize: '11px', color: 'var(--color-warning)' }}>{task.due_date}</span>
                                </div>
                            )}
                        </div>
                        {task.priority > 0 && (
                            <span style={{ display: 'flex', gap: '1px', flexShrink: 0 }}>
                                {Array.from({ length: Math.min(task.priority, 3) }, (_, i) => (
                                    <IconStar key={i} size={10} style={{ color: 'var(--color-warning)', fill: 'var(--color-warning)' }} />
                                ))}
                            </span>
                        )}
                    </div>
                ))}
            </div>
            {tasks.length > 0 && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    {pendingTasks.length} 項待辦 · {completedCount} 項已完成
                </p>
            )}
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
                <TaskPreviewCard />
            </div>
        </div>
    );
}
