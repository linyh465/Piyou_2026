/**
 * 課表頁面 / Timetable Page — iOS 風格
 * 週課表＋今日課程雙視圖 + 課程詳細 Modal
 */
import { useState, useEffect } from 'react';
import useTimetableStore from '../stores/timetableStore';
import { IconCalendar, IconRefresh, IconTrash, IconMapPin, IconClock, IconUser } from '../components/Icons';
import SyncLoginModal from '../components/SyncLoginModal';

const DAYS = ['一', '二', '三', '四', '五'];
const PERIODS_MORNING = [1, 2, 3, 4];
const PERIODS_AFTERNOON = [5, 6, 7, 8, 9];
const PERIODS_NIGHT = [10, 11, 12, 13];

const PERIOD_TIMES = {
    1: '08:10', 2: '09:10', 3: '10:10', 4: '11:10',
    5: '13:10', 6: '14:10', 7: '15:10', 8: '16:10',
    9: '17:10', 10: '18:05', 11: '19:00', 12: '19:55', 13: '20:50',
};
const PERIOD_END_TIMES = {
    1: '09:00', 2: '10:00', 3: '11:00', 4: '12:00',
    5: '14:00', 6: '15:00', 7: '16:00', 8: '17:00',
    9: '18:00', 10: '18:55', 11: '19:50', 12: '20:45', 13: '21:40',
};

/* ── 高對比度課程配色 (淺色 / 深色模式) ── */
const COURSE_COLORS = [
    { light: { bg: '#EDE7F6', text: '#4A148C' }, dark: { bg: '#3C2A5C', text: '#CE93D8' } },
    { light: { bg: '#FFF8E1', text: '#E65100' }, dark: { bg: '#4E3620', text: '#FFB74D' } },
    { light: { bg: '#E0F2F1', text: '#004D40' }, dark: { bg: '#1B3B36', text: '#80CBC4' } },
    { light: { bg: '#FCE4EC', text: '#880E4F' }, dark: { bg: '#4A1C2E', text: '#F48FB1' } },
    { light: { bg: '#E3F2FD', text: '#0D47A1' }, dark: { bg: '#1A3354', text: '#90CAF9' } },
    { light: { bg: '#F1F8E9', text: '#33691E' }, dark: { bg: '#2A3C1E', text: '#AED581' } },
    { light: { bg: '#FFF3E0', text: '#BF360C' }, dark: { bg: '#4A2C18', text: '#FFAB91' } },
];

function isDarkMode() {
    return document.documentElement.classList.contains('dark');
}

function getColorForCourse(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const palette = COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
    return isDarkMode() ? palette.dark : palette.light;
}

/* ── 課程詳細 Modal ── */
function CourseDetailModal({ course, onClose }) {
    // ESC 鍵關閉
    useEffect(() => {
        if (!course) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [course, onClose]);

    if (!course) return null;

    // 點擊 backdrop 關閉
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const c = getColorForCourse(course.name);
    const timeRange = course.period
        ? `${PERIOD_TIMES[course.period]} – ${PERIOD_END_TIMES[course.period]}`
        : course.time || '';
    const dayName = ['日', '一', '二', '三', '四', '五', '六'][course.day] || '';

    return (
        <div className="tt-modal-backdrop" onClick={handleBackdropClick}>
            <div className="tt-modal-sheet animate-fade-in">
                {/* 拖拽指示器 */}
                <div className="tt-modal-handle" />

                {/* 課程名稱 */}
                <div className="tt-modal-header" style={{ background: c.bg }}>
                    <h2 className="tt-modal-title" style={{ color: c.text }}>{course.name}</h2>
                    {course.name_en && (
                        <p className="tt-modal-subtitle" style={{ color: c.text, opacity: 0.7 }}>{course.name_en}</p>
                    )}
                </div>

                {/* 詳細資訊 */}
                <div className="tt-modal-body">
                    <div className="tt-modal-row">
                        <span className="tt-modal-label">⏰ 時間</span>
                        <span className="tt-modal-value">星期{dayName} 第 {course.period} 節 ・ {timeRange}</span>
                    </div>

                    {course.location && (
                        <div className="tt-modal-row">
                            <span className="tt-modal-label">📍 教室</span>
                            <span className="tt-modal-value">{course.location}</span>
                        </div>
                    )}

                    {course.teacher && (
                        <div className="tt-modal-row">
                            <span className="tt-modal-label">👤 教師</span>
                            <span className="tt-modal-value">{course.teacher}</span>
                        </div>
                    )}

                    {course.teacher_email && (
                        <div className="tt-modal-row">
                            <span className="tt-modal-label">📧 Email</span>
                            <a className="tt-modal-value tt-modal-link" href={`mailto:${course.teacher_email}`}>
                                {course.teacher_email}
                            </a>
                        </div>
                    )}

                    {course.course_type && (
                        <div className="tt-modal-row">
                            <span className="tt-modal-label">📋 修別</span>
                            <span className="tt-modal-value">{course.course_type}</span>
                        </div>
                    )}

                    {course.credits != null && (
                        <div className="tt-modal-row">
                            <span className="tt-modal-label">🎓 學分</span>
                            <span className="tt-modal-value">{course.credits} 學分</span>
                        </div>
                    )}
                </div>

                <button className="tt-modal-close-btn" onClick={onClose}>關閉</button>
            </div>
        </div>
    );
}

function WeekView({ timetable, isLoading, onCourseClick }) {
    const matrix = {};
    timetable.forEach((course) => { matrix[`${course.day}-${course.period}`] = course; });

    // 判斷有課的時段範圍
    const usedPeriods = new Set(timetable.map(c => c.period));
    const hasNight = [...usedPeriods].some(p => p >= 10);
    const periodsToShow = hasNight
        ? [...PERIODS_MORNING, ...PERIODS_AFTERNOON, ...PERIODS_NIGHT]
        : [...PERIODS_MORNING, ...PERIODS_AFTERNOON];

    // 分組：上午 / 下午
    const morningPeriods = periodsToShow.filter(p => p <= 4);
    const afternoonPeriods = periodsToShow.filter(p => p >= 5);

    const renderBlock = (periods) => (
        <div className="tt-grid-block">
            {periods.map((period) => (
                <div key={period} className="tt-row">
                    <div className="tt-time-cell">
                        <span className="tt-period-num">{period}</span>
                        <span className="tt-period-time">{PERIOD_TIMES[period]}</span>
                        <span className="tt-period-time">{PERIOD_END_TIMES[period]}</span>
                    </div>
                    {[1, 2, 3, 4, 5].map((day) => {
                        const course = matrix[`${day}-${period}`];
                        if (isLoading) {
                            return <td key={day} className="tt-cell"><div className="skeleton" style={{ height: '100%', width: '100%', borderRadius: '12px' }} /></td>;
                        }
                        if (!course) return <div key={day} className="tt-cell" />;
                        const c = getColorForCourse(course.name);
                        return (
                            <div key={day} className="tt-cell">
                                <div
                                    className="tt-course-block"
                                    style={{ background: c.bg, color: c.text }}
                                    title={`${course.name}${course.location ? ` — ${course.location}` : ''}`}
                                    onClick={() => onCourseClick(course)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter') onCourseClick(course); }}
                                >
                                    <span className="tt-course-name">{course.name}</span>
                                    {course.location && (
                                        <span className="tt-course-location">{course.location}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );

    return (
        <div className="card tt-card">
            {/* Header row */}
            <div className="tt-header-row">
                <div className="tt-time-cell"><span className="tt-header-label">時間</span></div>
                {DAYS.map((day) => (
                    <div key={day} className="tt-header-cell">{day}</div>
                ))}
            </div>

            {renderBlock(morningPeriods)}
            {afternoonPeriods.length > 0 && (
                <>
                    <div style={{ height: '8px' }} />
                    {renderBlock(afternoonPeriods)}
                </>
            )}
        </div>
    );
}

function TodayView({ timetable, isLoading, onCourseClick }) {
    const now = new Date();
    const dayIndex = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todayClasses = timetable
        .filter((c) => c.day === dayIndex)
        .sort((a, b) => (a.period || 0) - (b.period || 0));

    if (isLoading) {
        return (
            <div className="card-stack">
                {[1, 2, 3].map(i => (
                    <div key={i} className="card" style={{ padding: '16px' }}>
                        <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }} />
                        <div className="skeleton" style={{ height: 14, width: '40%' }} />
                    </div>
                ))}
            </div>
        );
    }

    if (!todayClasses.length) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>今天沒有課程 🎉</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 6 }}>享受你的休息日吧</p>
            </div>
        );
    }

    return (
        <div className="card-stack">
            {todayClasses.map((course, i) => {
                const startMin = (parseInt(PERIOD_TIMES[course.period]?.split(':')[0]) || 0) * 60 +
                    (parseInt(PERIOD_TIMES[course.period]?.split(':')[1]) || 0);
                const endMin = (parseInt(PERIOD_END_TIMES[course.period]?.split(':')[0]) || 0) * 60 +
                    (parseInt(PERIOD_END_TIMES[course.period]?.split(':')[1]) || 0);
                const isNow = currentMinutes >= startMin && currentMinutes < endMin;
                const isPast = currentMinutes >= endMin;

                return (
                    <div
                        key={i}
                        className="card tt-today-card"
                        style={{
                            opacity: isPast ? 0.5 : 1,
                            borderLeft: isNow ? '3px solid var(--color-success)' : '3px solid transparent',
                            cursor: 'pointer',
                        }}
                        onClick={() => onCourseClick(course)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') onCourseClick(course); }}
                    >
                        {isNow && (
                            <span className="dash-status-badge dash-status-active" style={{ marginBottom: 8 }}>
                                <span className="dash-status-dot" />上課中
                            </span>
                        )}
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{course.name}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <IconClock size={14} /> {PERIOD_TIMES[course.period]} - {PERIOD_END_TIMES[course.period]}
                            </span>
                            {course.location && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <IconMapPin size={14} /> {course.location}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function Timetable() {
    const { timetable, isLoadingTimetable, timetableError, isTimeout, fetchTimetable, clearTimetableData, canSync } = useTimetableStore();
    const [view, setView] = useState('week');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [showSyncModal, setShowSyncModal] = useState(false);

    const handleClearTimetable = async () => {
        const syncCheck = await canSync();
        let msg = '確定要清除課表資料嗎？';
        if (!syncCheck.allowed) {
            const mins = Math.ceil((syncCheck.remainingMs || 0) / 60000);
            msg += `\n\n⚠️ 冷卻時間: ${mins}分，需待冷卻結束後才可再次同步校園資料。`;
        }
        if (window.confirm(msg)) clearTimetableData();
    };

    return (
        <div className="section-stack animate-fade-in">
            {/* 標題 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h1 className="dash-hero-title" style={{ paddingBottom: 0 }}>課表</h1>
                <div style={{ display: 'flex', gap: '8px', paddingTop: '6px' }}>
                    <button onClick={() => setShowSyncModal(true)} className="btn btn-soft" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconUser size={14} /> 一鍵登入
                    </button>
                    <button onClick={fetchTimetable} disabled={isLoadingTimetable} className="btn btn-ghost" style={{ fontSize: '13px' }}>
                        <IconRefresh size={15} className={isLoadingTimetable ? 'animate-spin' : ''} />
                    </button>
                    {timetable.length > 0 && (
                        <button onClick={handleClearTimetable} className="btn btn-ghost" style={{ fontSize: '13px', color: 'var(--color-danger)' }}>
                            <IconTrash size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* 視圖切換 */}
            <div className="tt-view-toggle">
                <button
                    className={`tt-view-btn ${view === 'week' ? 'active' : ''}`}
                    onClick={() => setView('week')}
                >
                    週課表
                </button>
                <button
                    className={`tt-view-btn ${view === 'today' ? 'active' : ''}`}
                    onClick={() => setView('today')}
                >
                    今日課程
                </button>
            </div>

            {/* 錯誤 */}
            {isTimeout && (
                <div className="card" style={{ borderColor: 'var(--color-danger)', background: 'rgba(239,68,68,0.04)' }}>
                    <p style={{ fontWeight: 600, color: 'var(--color-danger)' }}>⏱ 請求逾時</p>
                    <p style={{ fontSize: '14px', marginTop: '6px', color: 'var(--text-muted)' }}>{timetableError}</p>
                    <button onClick={fetchTimetable} className="btn btn-soft" style={{ marginTop: '12px', fontSize: '13px' }}>重試</button>
                </div>
            )}
            {timetableError && !isTimeout && (
                <div className="card" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245,158,11,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-warning)' }}>⚠️ {timetableError}</p>
                </div>
            )}

            {/* 內容 */}
            {view === 'week' ? (
                <WeekView timetable={timetable} isLoading={isLoadingTimetable} onCourseClick={setSelectedCourse} />
            ) : (
                <TodayView timetable={timetable} isLoading={isLoadingTimetable} onCourseClick={setSelectedCourse} />
            )}

            {!isLoadingTimetable && timetable.length > 0 && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
                    本學期共 {new Set(timetable.map((c) => c.name)).size} 門課，{timetable.length} 節
                </p>
            )}

            {/* 課程詳細 Modal */}
            <CourseDetailModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />

            {/* 同步登入 Modal */}
            <SyncLoginModal show={showSyncModal} onClose={() => setShowSyncModal(false)} />
        </div>
    );
}
