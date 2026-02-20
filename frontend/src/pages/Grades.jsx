/**
 * 成績頁面 / Grades Page
 * 間距參考 Dcard / Instagram
 */
import { useEffect } from 'react';
import useTimetableStore from '../stores/timetableStore';
import { IconChartBar, IconRefresh, IconBook } from '../components/Icons';

function calculateGPA(grades) {
    if (!grades.length) return 0;
    const total = grades.reduce((sum, g) => sum + (g.score || 0) * (g.credits || 0), 0);
    const credits = grades.reduce((sum, g) => sum + (g.credits || 0), 0);
    return credits ? (total / credits).toFixed(2) : 0;
}

function scoreColor(score) {
    if (score >= 80) return 'var(--color-success)';
    if (score >= 60) return 'var(--color-warning)';
    return 'var(--color-danger)';
}

export default function Grades() {
    const { grades, isLoadingGrades, gradesError, fetchGrades } = useTimetableStore();

    useEffect(() => { fetchGrades(); }, [fetchGrades]);

    return (
        <div className="section-stack animate-fade-in">
            <div className="page-header">
                <div className="page-title-group">
                    <IconChartBar size={22} style={{ color: 'var(--text-muted)' }} />
                    <h2 className="page-title">成績查詢</h2>
                    <span className="page-subtitle">Grades</span>
                </div>
                <button onClick={fetchGrades} disabled={isLoadingGrades} className="btn btn-ghost" style={{ fontSize: '13px' }}>
                    <IconRefresh size={15} className={isLoadingGrades ? 'animate-spin' : ''} />
                    {isLoadingGrades ? '載入中...' : '重新整理'}
                </button>
            </div>

            {gradesError && (
                <div className="card" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245,158,11,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-warning)' }}>⚠️ {gradesError}</p>
                </div>
            )}

            {isLoadingGrades ? (
                <div className="card-stack">
                    {[1, 2].map((i) => (
                        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="skeleton" style={{ height: '20px', width: '128px' }} />
                            <div className="skeleton" style={{ height: '16px', width: '100%' }} />
                            <div className="skeleton" style={{ height: '16px', width: '100%' }} />
                            <div className="skeleton" style={{ height: '16px', width: '75%' }} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card-stack">
                    {grades.map((semester, idx) => (
                        <div key={idx} className="card animate-fade-in" style={{ animationDelay: `${idx * 0.08}s` }}>
                            {/* 學期標題 */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <IconBook size={18} style={{ color: 'var(--color-brand)' }} />
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                                        {semester.name || `第 ${idx + 1} 學期`}
                                    </h3>
                                </div>
                                <span className="badge" style={{ background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 700 }}>
                                    GPA {calculateGPA(semester.courses || [])}
                                </span>
                            </div>

                            {/* 成績列表 */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {(semester.courses || []).map((course, ci) => (
                                    <div
                                        key={ci}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '12px 8px', borderRadius: '10px',
                                            borderBottom: ci < (semester.courses || []).length - 1 ? '1px solid var(--border-light)' : 'none',
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {course.name}
                                            </p>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                {course.credits || 0} 學分 credits
                                            </p>
                                        </div>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: scoreColor(course.score || 0), marginLeft: '16px' }}>
                                            {course.score ?? '--'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* 學期統計 */}
                            <div style={{
                                marginTop: '14px', paddingTop: '14px',
                                display: 'flex', gap: '20px', fontSize: '12px',
                                borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)',
                            }}>
                                <span>共 {(semester.courses || []).length} 門 courses</span>
                                <span>{(semester.courses || []).reduce((s, c) => s + (c.credits || 0), 0)} 學分 credits</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isLoadingGrades && !grades.length && !gradesError && (
                <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <IconChartBar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>尚無成績資料</p>
                    <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>
                        請先登入以取得成績 Login to fetch grades
                    </p>
                </div>
            )}
        </div>
    );
}
