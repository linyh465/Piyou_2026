/**
 * 儀表板頁面 / Dashboard Page — iOS Native「今天」總覽
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useDashboardStore from '../stores/dashboardStore';
import useTimetableStore from '../stores/timetableStore';
import useTaskStore from '../stores/taskStore';
import useLibraryStore from '../stores/libraryStore';
import useLangStore from '../stores/langStore';
import {
    IconBook, IconMapPin, IconClock,
    IconCheckSquare, IconCalendar, IconStar, IconPlus, IconLibrary, IconUser,
    IconChevronRight,
} from '../components/Icons';

const PERIOD_TIMES = {
    1: '08:10-09:00', 2: '09:10-10:00', 3: '10:10-11:00', 4: '11:10-12:00',
    5: '13:10-14:00', 6: '14:10-15:00', 7: '15:10-16:00', 8: '16:10-17:00',
    9: '17:10-18:00', 10: '18:05-18:55', 11: '19:00-19:50', 12: '19:55-20:45', 13: '20:50-21:40',
};

const PERIOD_START_MINUTES = {
    1: 490, 2: 550, 3: 610, 4: 670,
    5: 790, 6: 850, 7: 910, 8: 970,
    9: 1030, 10: 1085, 11: 1140, 12: 1195, 13: 1250,
};
const PERIOD_END_MINUTES = {
    1: 540, 2: 600, 3: 660, 4: 720,
    5: 840, 6: 900, 7: 960, 8: 1020,
    9: 1080, 10: 1135, 11: 1190, 12: 1245, 13: 1300,
};

function formatDate(date, lang) {
    return new Intl.DateTimeFormat(lang, { month: 'long', day: 'numeric', weekday: 'long' }).format(date);
}

// ── 當前課堂卡片 / Current & Next Class Card ──
function CurrentClassCard() {
    const { t } = useTranslation('dashboard');
    const getNextClass = useDashboardStore((s) => s.getNextClass);
    const fetchTimetable = useTimetableStore((s) => s.fetchTimetable);
    const timetable = useTimetableStore((s) => s.timetable);
    const isLoading = useTimetableStore((s) => s.isLoadingTimetable);
    const hasFetched = useRef(false);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        if (!hasFetched.current) { hasFetched.current = true; fetchTimetable(); }
    }, [fetchTimetable]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const dayIndex = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todayClasses = timetable
        .filter((c) => c.day === dayIndex)
        .sort((a, b) => (a.period || 0) - (b.period || 0));

    let currentClass = null;
    let nextClass = null;
    for (const c of todayClasses) {
        const start = PERIOD_START_MINUTES[c.period] ?? c.startMinute;
        const end = PERIOD_END_MINUTES[c.period] ?? (start + 50);
        if (currentMinutes >= start && currentMinutes < end) {
            currentClass = { ...c, startMin: start, endMin: end };
        } else if (currentMinutes < start && !nextClass) {
            nextClass = { ...c, startMin: start, endMin: end };
        }
    }

    if (!currentClass && !nextClass) {
        nextClass = getNextClass();
    }

    if (isLoading && !timetable.length) {
        return (
            <div className="card" style={{ padding: '24px' }}>
                <div className="skeleton" style={{ height: '14px', width: '80px', marginBottom: '16px', borderRadius: '8px' }} />
                <div className="skeleton" style={{ height: '22px', width: '180px', marginBottom: '14px', borderRadius: '8px' }} />
                <div className="skeleton" style={{ height: '6px', width: '100%', borderRadius: '8px' }} />
            </div>
        );
    }

    let progress = 0;
    let remainingMin = 0;
    if (currentClass) {
        const elapsed = currentMinutes - currentClass.startMin;
        const total = currentClass.endMin - currentClass.startMin;
        progress = Math.min(Math.max(elapsed / total, 0), 1);
        remainingMin = Math.max(currentClass.endMin - currentMinutes, 0);
    }

    const timeStr = (c) => PERIOD_TIMES[c.period] || c.time || '';

    return (
        <div className="dash-class-section" style={{ gap: '12px' }}>
            {currentClass ? (
                <div className="card dash-current-card" style={{ padding: '20px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span className="dash-status-badge dash-status-active">
                            <span className="dash-status-dot" />
                            {t('classInProgress')}
                        </span>
                        <span style={{
                            fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)',
                            background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: '20px',
                        }}>
                            {t('remaining', { min: remainingMin })}
                        </span>
                    </div>

                    <h3 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text)', marginBottom: '14px', letterSpacing: '-0.02em' }}>
                        {currentClass.name}
                    </h3>

                    <div className="dash-progress-track" style={{ height: '5px', borderRadius: '5px' }}>
                        <div className="dash-progress-fill" style={{ width: `${progress * 100}%` }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <IconMapPin size={14} /> {currentClass.location || t('locationUnset')}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <IconClock size={14} /> {timeStr(currentClass)}
                        </span>
                        {currentClass.teacher && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <IconUser size={14} /> {currentClass.teacher}
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                !nextClass && (
                    <div className="card" style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--bg-card)' }}>
                        <p style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</p>
                        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {t('noMoreClasses')}
                        </p>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {t('restWell')}
                        </p>
                    </div>
                )
            )}

            {nextClass && (
                <div className="dash-next-class">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                            fontSize: '12px', fontWeight: 600, color: 'var(--color-warning)',
                            background: 'rgba(255,149,0,0.1)', padding: '2px 10px', borderRadius: '20px',
                        }}>
                            {t('nextClass')}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {nextClass.minutesUntil != null ? t('minutesUntil', { min: nextClass.minutesUntil }) : timeStr(nextClass)}
                        </span>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginTop: '6px' }}>
                        {nextClass.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {nextClass.location && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <IconMapPin size={12} /> {nextClass.location}
                            </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconClock size={12} /> {timeStr(nextClass)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── 待辦事項區塊 / Task Section ──
function TaskSection() {
    const { t } = useTranslation('dashboard');
    const { t: tCommon } = useTranslation('common');
    const loadTasks = useTaskStore((s) => s.loadTasks);
    const tasks = useTaskStore((s) => s.tasks);
    const isLoading = useTaskStore((s) => s.isLoading);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!hasFetched.current) { hasFetched.current = true; loadTasks(); }
    }, [loadTasks]);

    const pendingTasks = tasks.filter((t) => !t.completed).slice(0, 3);

    if (isLoading && !tasks.length) return null;
    if (!pendingTasks.length && !tasks.length) return null;

    return (
        <div className="dash-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="dash-section-title">{t('todos')}</h3>
                <a href="#/tasks" style={{
                    fontSize: '13px', color: 'var(--color-brand)', textDecoration: 'none',
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: '2px',
                }}>
                    {tCommon('viewAll')} <IconChevronRight size={14} />
                </a>
            </div>
            {pendingTasks.length === 0 ? (
                <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.25rem', marginBottom: '4px' }}>🎉</p>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {t('allDone')}
                    </p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {pendingTasks.map((task, i) => {
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                        return (
                            <a
                                key={task.id}
                                href="#/tasks"
                                className="dash-task-row"
                                style={{
                                    borderBottom: i < pendingTasks.length - 1 ? '1px solid var(--border-light)' : 'none',
                                    padding: '16px 20px',
                                }}
                            >
                                <span style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: isOverdue ? 'var(--color-danger)' : task.priority > 0 ? 'var(--color-warning)' : 'var(--color-brand)',
                                    flexShrink: 0,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        fontSize: '15px', fontWeight: 500, color: 'var(--text)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {task.title}
                                    </p>
                                    {task.due_date && (
                                        <p style={{
                                            fontSize: '12px',
                                            color: isOverdue ? 'var(--color-danger)' : 'var(--text-muted)',
                                            marginTop: '2px', fontWeight: isOverdue ? 500 : 400,
                                        }}>
                                            {isOverdue ? `${t('overdue')} · ` : ''}{task.due_date}
                                        </p>
                                    )}
                                </div>
                                {task.priority > 0 && !isOverdue && (
                                    <span style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                        {Array.from({ length: Math.min(task.priority, 3) }, (_, j) => (
                                            <IconStar key={j} size={12} style={{ color: 'var(--color-warning)', fill: 'var(--color-warning)' }} />
                                        ))}
                                    </span>
                                )}
                                <IconChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── 圖書館借閱預覽 / Library Preview ──
function LibrarySection() {
    const { t } = useTranslation('dashboard');
    const { t: tCommon } = useTranslation('common');
    const loans = useLibraryStore((s) => s.loans);
    const overdueBooks = loans.filter(b => b.is_overdue);
    const dueSoonBooks = loans.filter(b => {
        if (b.is_overdue || !b.due_date) return false;
        const diff = (new Date(b.due_date) - new Date()) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff > 0;
    });

    if (!loans.length) return null;

    return (
        <div className="dash-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="dash-section-title">{t('libraryLoans')}</h3>
                <a href="#/library" style={{
                    fontSize: '13px', color: 'var(--color-brand)', textDecoration: 'none',
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: '2px',
                }}>
                    {tCommon('viewAll')} <IconChevronRight size={14} />
                </a>
            </div>
            <div className="card" style={{ padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: 'var(--color-pastel-blue, #D3E4FD)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <IconLibrary size={20} style={{ color: 'var(--color-brand)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                            {t('borrowingCount', { count: loans.length })}
                        </p>
                        {overdueBooks.length > 0 && (
                            <p style={{ fontSize: '13px', color: 'var(--color-danger)', marginTop: '3px', fontWeight: 600 }}>
                                {t('overdueCount', { count: overdueBooks.length })}
                            </p>
                        )}
                        {dueSoonBooks.length > 0 && overdueBooks.length === 0 && (
                            <p style={{ fontSize: '13px', color: 'var(--color-warning)', marginTop: '3px' }}>
                                {t('dueSoonCount', { count: dueSoonBooks.length })}
                            </p>
                        )}
                        {overdueBooks.length === 0 && dueSoonBooks.length === 0 && (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                {t('loanStatusNormal')}
                            </p>
                        )}
                    </div>
                    <IconChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
            </div>
        </div>
    );
}

const ZH_BLESSINGS = [
    '今天也要元氣滿滿 ✨', '加油，你最棒了 💪', '一步一步來，穩穩的 🌟',
    '今天也是充滿可能的一天 🌈', '記得喝水、好好吃飯 🥤', '你做得到的 🎯',
    '今天也辛苦了 ☕', '保持微笑，一切都會好的 😊', '休息也是前進的一部分 🌙',
    '今天的你已經很厲害了 🏆',
];
const EN_BLESSINGS = [
    'Have a great day! ✨', 'You\'ve got this 💪', 'One step at a time 🌟',
    'Today is full of possibilities 🌈', 'Stay hydrated and eat well 🥤',
    'Believe in yourself 🎯', 'Keep up the good work ☕',
    'Keep smiling — it\'ll be okay 😊', 'Rest is part of the journey 🌙',
    'You\'re doing amazing 🏆',
];

function getGreeting(hour, lang) {
    if (lang === 'en') {
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }
    if (hour < 12) return '早安';
    if (hour < 18) return '午安';
    return '晚安';
}

function getRandomBlessing(lang) {
    const list = lang === 'en' ? EN_BLESSINGS : ZH_BLESSINGS;
    return list[Math.floor(Math.random() * list.length)];
}

// ── 主頁面 / Main Page ──
export default function Dashboard() {
    const { lang } = useLangStore();
    const now = new Date();
    const greeting = getGreeting(now.getHours(), lang);
    const blessing = getRandomBlessing(lang);

    return (
        <div className="dash-page animate-fade-in">
            <div>
                <h1 className="dash-hero-title">{greeting}</h1>
                <p className="dash-hero-date">{formatDate(now, lang)}</p>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '6px' }}>{blessing}</p>
            </div>
            <CurrentClassCard />
            <TaskSection />
            <LibrarySection />
        </div>
    );
}
