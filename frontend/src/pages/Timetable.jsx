/**
 * 課表頁面 / Timetable Page
 * 每週課表格格視圖，含 Loading 骨架與 Timeout 錯誤顯示
 * Weekly grid view of classes with loading skeleton and timeout error display.
 */
import { useEffect } from 'react';
import useTimetableStore from '../stores/timetableStore';

const DAYS = ['日 Sun', '一 Mon', '二 Tue', '三 Wed', '四 Thu', '五 Fri', '六 Sat'];
const PERIODS = Array.from({ length: 13 }, (_, i) => i + 1);

// 課表格色彩 / Course color palette
const COLORS = [
    'bg-indigo-500/30 border-indigo-400/40 text-indigo-200',
    'bg-amber-500/30 border-amber-400/40 text-amber-200',
    'bg-cyan-500/30 border-cyan-400/40 text-cyan-200',
    'bg-rose-500/30 border-rose-400/40 text-rose-200',
    'bg-emerald-500/30 border-emerald-400/40 text-emerald-200',
    'bg-violet-500/30 border-violet-400/40 text-violet-200',
    'bg-orange-500/30 border-orange-400/40 text-orange-200',
];

function getColorForCourse(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Timetable() {
    const {
        timetable,
        isLoadingTimetable,
        timetableError,
        isTimeout,
        fetchTimetable,
    } = useTimetableStore();

    useEffect(() => {
        fetchTimetable();
    }, [fetchTimetable]);

    // 建立課表矩陣 / Build timetable matrix
    const matrix = {};
    timetable.forEach((course) => {
        const key = `${course.day}-${course.period}`;
        matrix[key] = course;
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">📅 每週課表 / Weekly Schedule</h2>
                <button
                    onClick={fetchTimetable}
                    disabled={isLoadingTimetable}
                    className="text-sm bg-primary/20 hover:bg-primary/40 text-primary-light px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                    {isLoadingTimetable ? '載入中...' : '🔄 重新整理'}
                </button>
            </div>

            {/* 逾時錯誤 / Timeout error */}
            {isTimeout && (
                <div className="glass-card p-4 border-danger/30 bg-danger/10 animate-fade-in-up">
                    <p className="text-danger font-medium">⏱ 請求逾時 / Request Timeout</p>
                    <p className="text-sm text-text-muted mt-1">{timetableError}</p>
                    <button
                        onClick={fetchTimetable}
                        className="mt-2 text-sm bg-danger/20 hover:bg-danger/30 text-danger px-3 py-1 rounded-lg transition-colors"
                    >
                        重試 / Retry
                    </button>
                </div>
            )}

            {/* 一般錯誤 / General error */}
            {timetableError && !isTimeout && (
                <div className="glass-card p-4 border-warning/30 bg-warning/10 animate-fade-in-up">
                    <p className="text-warning text-sm">⚠️ {timetableError}</p>
                </div>
            )}

            {/* 課表格子 / Timetable grid */}
            <div className="glass-card p-3 overflow-x-auto animate-fade-in-up">
                <table className="w-full text-xs min-w-[600px]">
                    <thead>
                        <tr>
                            <th className="w-10 py-2 text-text-muted font-normal">#</th>
                            {DAYS.slice(1, 7).map((day) => (
                                <th key={day} className="py-2 text-text-secondary font-medium text-center">
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {PERIODS.map((period) => (
                            <tr key={period} className="border-t border-white/5">
                                <td className="py-2 text-text-muted text-center font-mono">{period}</td>
                                {[1, 2, 3, 4, 5, 6].map((day) => {
                                    const course = matrix[`${day}-${period}`];
                                    if (isLoadingTimetable) {
                                        return (
                                            <td key={day} className="p-1">
                                                <div className="skeleton h-8 w-full" />
                                            </td>
                                        );
                                    }
                                    return (
                                        <td key={day} className="p-1">
                                            {course && (
                                                <div
                                                    className={`${getColorForCourse(course.name)} border rounded-md px-1.5 py-1 text-center truncate cursor-pointer hover:scale-105 transition-transform`}
                                                    title={`${course.name}\n${course.location || ''}`}
                                                >
                                                    <div className="font-medium truncate">{course.name}</div>
                                                    {course.location && (
                                                        <div className="text-[10px] opacity-70 truncate">{course.location}</div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 課程總覽 / Course summary */}
            {!isLoadingTimetable && timetable.length > 0 && (
                <div className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <p className="text-sm text-text-muted mb-2">
                        📊 本學期共 {new Set(timetable.map((c) => c.name)).size} 門課，
                        {timetable.length} 節 / {new Set(timetable.map((c) => c.name)).size} courses, {timetable.length} periods
                    </p>
                </div>
            )}
        </div>
    );
}
