/**
 * 課表頁面 / Timetable Page
 * 間距參考 Dcard / Instagram
 */
import { useEffect } from 'react';
import useTimetableStore from '../stores/timetableStore';
import { IconCalendar, IconRefresh } from '../components/Icons';

const DAYS = ['一', '二', '三', '四', '五', '六'];
const PERIODS = Array.from({ length: 13 }, (_, i) => i + 1);

const COLORS = [
    { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)', text: '#6366f1' },
    { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b' },
    { bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.25)', text: '#14b8a6' },
    { bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.25)', text: '#f43f5e' },
    { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#22c55e' },
    { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)', text: '#8b5cf6' },
    { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', text: '#f97316' },
];

function getColorForCourse(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Timetable() {
    const { timetable, isLoadingTimetable, timetableError, isTimeout, fetchTimetable } = useTimetableStore();

    useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

    const matrix = {};
    timetable.forEach((course) => { matrix[`${course.day}-${course.period}`] = course; });

    return (
        <div className="section-stack animate-fade-in">
            {/* 標題 */}
            <div className="page-header">
                <div className="page-title-group">
                    <IconCalendar size={22} style={{ color: 'var(--text-muted)' }} />
                    <h2 className="page-title">每週課表</h2>
                    <span className="page-subtitle">Weekly Schedule</span>
                </div>
                <button onClick={fetchTimetable} disabled={isLoadingTimetable} className="btn btn-ghost" style={{ fontSize: '13px' }}>
                    <IconRefresh size={15} className={isLoadingTimetable ? 'animate-spin' : ''} />
                    {isLoadingTimetable ? '載入中...' : '重新整理'}
                </button>
            </div>

            {/* 逾時錯誤 */}
            {isTimeout && (
                <div className="card" style={{ borderColor: 'var(--color-danger)', background: 'rgba(239,68,68,0.04)' }}>
                    <p style={{ fontWeight: 600, color: 'var(--color-danger)' }}>⏱ 請求逾時 Request Timeout</p>
                    <p style={{ fontSize: '14px', marginTop: '6px', color: 'var(--text-muted)' }}>{timetableError}</p>
                    <button onClick={fetchTimetable} className="btn btn-soft" style={{ marginTop: '12px', fontSize: '13px' }}>重試 Retry</button>
                </div>
            )}

            {timetableError && !isTimeout && (
                <div className="card" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245,158,11,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-warning)' }}>⚠️ {timetableError}</p>
                </div>
            )}

            {/* 課表格子 */}
            <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', minWidth: '560px', borderCollapse: 'separate', borderSpacing: '2px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '36px', padding: '10px 0', fontWeight: 400, color: 'var(--text-muted)' }}>#</th>
                            {DAYS.map((day) => (
                                <th key={day} style={{ padding: '10px 0', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'center' }}>
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {PERIODS.map((period) => (
                            <tr key={period}>
                                <td style={{ padding: '6px 0', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '11px' }}>{period}</td>
                                {[1, 2, 3, 4, 5, 6].map((day) => {
                                    const course = matrix[`${day}-${period}`];
                                    if (isLoadingTimetable) {
                                        return <td key={day} style={{ padding: '3px' }}><div className="skeleton" style={{ height: '36px', width: '100%' }} /></td>;
                                    }
                                    return (
                                        <td key={day} style={{ padding: '3px' }}>
                                            {course && (() => {
                                                const c = getColorForCourse(course.name);
                                                return (
                                                    <div
                                                        style={{
                                                            borderRadius: '10px', padding: '6px', textAlign: 'center',
                                                            cursor: 'pointer', transition: 'transform 0.15s',
                                                            background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                                                            overflow: 'hidden',
                                                        }}
                                                        title={`${course.name}\n${course.location || ''}`}
                                                    >
                                                        <div style={{ fontWeight: 600, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</div>
                                                        {course.location && (
                                                            <div style={{ fontSize: '9px', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.location}</div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 課程總覽 */}
            {!isLoadingTimetable && timetable.length > 0 && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
                    本學期共 {new Set(timetable.map((c) => c.name)).size} 門課，{timetable.length} 節
                </p>
            )}
        </div>
    );
}
