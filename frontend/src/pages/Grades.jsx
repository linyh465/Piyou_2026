/**
 * 成績頁面 / Grades Page
 * 按學期分組顯示成績，含 GPA 計算
 * Semester-grouped grade display with GPA calculation.
 */
import { useEffect } from 'react';
import useTimetableStore from '../stores/timetableStore';

function calculateGPA(grades) {
    if (!grades.length) return 0;
    const total = grades.reduce((sum, g) => sum + (g.score || 0) * (g.credits || 0), 0);
    const credits = grades.reduce((sum, g) => sum + (g.credits || 0), 0);
    return credits ? (total / credits).toFixed(2) : 0;
}

export default function Grades() {
    const { grades, isLoadingGrades, gradesError, fetchGrades } = useTimetableStore();

    useEffect(() => {
        fetchGrades();
    }, [fetchGrades]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">📊 成績查詢 / Grades</h2>
                <button
                    onClick={fetchGrades}
                    disabled={isLoadingGrades}
                    className="text-sm bg-primary/20 hover:bg-primary/40 text-primary-light px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                    {isLoadingGrades ? '載入中...' : '🔄 重新整理'}
                </button>
            </div>

            {gradesError && (
                <div className="glass-card p-4 border-warning/30 bg-warning/10 animate-fade-in-up">
                    <p className="text-warning text-sm">⚠️ {gradesError}</p>
                </div>
            )}

            {isLoadingGrades ? (
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="glass-card p-4 space-y-3">
                            <div className="skeleton h-5 w-32" />
                            <div className="skeleton h-4 w-full" />
                            <div className="skeleton h-4 w-full" />
                            <div className="skeleton h-4 w-3/4" />
                        </div>
                    ))}
                </div>
            ) : (
                grades.map((semester, idx) => (
                    <div key={idx} className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                        {/* 學期標題 / Semester header */}
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-primary-light">
                                🎓 {semester.name || `第 ${idx + 1} 學期`}
                            </h3>
                            <span className="bg-secondary/20 text-secondary px-2.5 py-1 rounded-full text-sm font-bold">
                                GPA {calculateGPA(semester.courses || [])}
                            </span>
                        </div>

                        {/* 成績列表 / Grade list */}
                        <div className="space-y-1.5">
                            {(semester.courses || []).map((course, ci) => (
                                <div
                                    key={ci}
                                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">{course.name}</p>
                                        <p className="text-xs text-text-muted">{course.credits || 0} 學分 / credits</p>
                                    </div>
                                    <div className="text-right ml-3">
                                        <span
                                            className={`text-lg font-bold ${(course.score || 0) >= 80
                                                    ? 'text-success'
                                                    : (course.score || 0) >= 60
                                                        ? 'text-secondary'
                                                        : 'text-danger'
                                                }`}
                                        >
                                            {course.score ?? '--'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 學期統計 / Semester stats */}
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-4 text-xs text-text-muted">
                            <span>
                                共 {(semester.courses || []).length} 門 / {(semester.courses || []).length} courses
                            </span>
                            <span>
                                {(semester.courses || []).reduce((s, c) => s + (c.credits || 0), 0)} 學分 / credits
                            </span>
                        </div>
                    </div>
                ))
            )}

            {!isLoadingGrades && !grades.length && !gradesError && (
                <div className="glass-card p-8 text-center animate-fade-in-up">
                    <p className="text-4xl mb-3">📭</p>
                    <p className="text-text-secondary">尚無成績資料 / No grades yet</p>
                    <p className="text-sm text-text-muted mt-1">請先登入以取得成績 / Login to fetch grades</p>
                </div>
            )}
        </div>
    );
}
