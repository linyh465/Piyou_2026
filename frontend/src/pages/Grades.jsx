/**
 * 成績頁面 / Grades Page
 * GPA 上限 4.3，「缺」「通過」等文字成績不納入計算
 */
import { useState } from 'react';
import useTimetableStore from '../stores/timetableStore';
import { IconChartBar, IconRefresh, IconBook, IconTrash } from '../components/Icons';
import { scoreToGPA } from '../utils/scoreToGPA';

// 是否為數字成績（排除缺、通過等文字）
function isNumericCourse(course) {
    return course.score != null && course.score_text == null;
}

function calculateStats(courses) {
    const numeric = (courses || []).filter(isNumericCourse);
    if (!numeric.length) return { gpa: null, weightedAvg: null, numericCredits: 0 };

    let totalWeighted = 0;
    let totalGPA = 0;
    let credits = 0;

    for (const c of numeric) {
        const cr = c.credits || 0;
        totalWeighted += (c.score || 0) * cr;
        totalGPA += scoreToGPA(c.score || 0) * cr;
        credits += cr;
    }

    const weightedAvg = credits ? (totalWeighted / credits).toFixed(1) : null;
    let gpa = credits ? (totalGPA / credits).toFixed(2) : null;
    if (gpa !== null && parseFloat(gpa) > 4.3) gpa = '4.30';

    return { gpa, weightedAvg, numericCredits: credits };
}

function scoreColor(course) {
    if (!isNumericCourse(course)) return 'var(--text-muted)';
    const s = course.score;
    if (s >= 80) return 'var(--color-success)';
    if (s >= 60) return 'var(--color-warning)';
    return 'var(--color-danger)';
}

function displayScore(course) {
    if (course.score_text) return course.score_text;
    if (course.score != null) return course.score;
    return '--';
}

export default function Grades() {
    const { grades, isLoadingGrades, gradesError, fetchGrades, clearGradesData, canSync } = useTimetableStore();
    const [selectedSemester, setSelectedSemester] = useState('all');

    // 資料已從 localStorage 載入 zustand，不自動 fetch，避免清除後 in-flight 請求覆寫
    // Data is already loaded from localStorage into zustand; skip auto-fetch to avoid race condition on clear

    /** 清除成績並顯示冷卻提示 / Clear grades with cooldown notice */
    const handleClearGrades = async () => {
        const syncCheck = await canSync();
        let msg = '確定要清除成績資料嗎？';
        if (!syncCheck.allowed) {
            const mins = Math.ceil((syncCheck.remainingMs || 0) / 60000);
            msg += `\n\n⚠️ 冷卻時間: ${mins}分，需待冷卻結束後才可再次同步校務資料。`;
        }
        if (window.confirm(msg)) clearGradesData();
    };

    // 篩選學期 / Filter semesters
    const filteredGrades = selectedSemester === 'all'
        ? grades
        : grades.filter((s) => s.name === selectedSemester);

    // 全學期綜合統計 / Overall statistics across all semesters
    const overallStats = (() => {
        if (!grades.length) return null;
        const allNumeric = grades.flatMap((s) => (s.courses || []).filter(isNumericCourse));
        if (!allNumeric.length) return null;
        let totalWeighted = 0, totalGPA = 0, credits = 0;
        for (const c of allNumeric) {
            const cr = c.credits || 0;
            totalWeighted += (c.score || 0) * cr;
            totalGPA += scoreToGPA(c.score || 0) * cr;
            credits += cr;
        }
        return {
            gpa: credits ? (totalGPA / credits).toFixed(2) : null,
            avg: credits ? (totalWeighted / credits).toFixed(1) : null,
            totalCourses: grades.reduce((s, sem) => s + (sem.courses || []).length, 0),
            totalCredits: grades.reduce((s, sem) => s + (sem.courses || []).reduce((cs, c) => cs + (c.credits || 0), 0), 0),
        };
    })();

    return (
        <div className="section-stack">
            <div className="page-header">
                <div className="page-title-group">
                    <IconChartBar size={22} style={{ color: 'var(--text-muted)' }} />
                    <h2 className="page-title">成績查詢</h2>
                    <span className="page-subtitle">Grades</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={fetchGrades} disabled={isLoadingGrades} className="btn btn-ghost" style={{ fontSize: '13px' }} aria-label="重新整理成績">
                        <IconRefresh size={15} className={isLoadingGrades ? 'animate-spin' : ''} />
                        {isLoadingGrades ? '載入中...' : '重新整理'}
                    </button>
                    {grades.length > 0 && (
                        <button
                            onClick={handleClearGrades}
                            className="btn btn-ghost"
                            style={{ fontSize: '13px', color: 'var(--color-danger)' }}
                            aria-label="清除成績資料"
                        >
                            <IconTrash size={15} />
                            清除成績
                        </button>
                    )}
                </div>
            </div>

            {gradesError && (
                <div className="card" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245,158,11,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-warning)' }}>⚠️ {gradesError}</p>
                </div>
            )}

            {/* 學期選擇標籤 / Semester tabs */}
            {!isLoadingGrades && grades.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <button
                        onClick={() => setSelectedSemester('all')}
                        className={`btn ${selectedSemester === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: '12px', padding: '6px 14px', whiteSpace: 'nowrap', borderRadius: '20px' }}
                    >
                        全部學期
                    </button>
                    {grades.map((s) => (
                        <button
                            key={s.name}
                            onClick={() => setSelectedSemester(s.name)}
                            className={`btn ${selectedSemester === s.name ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ fontSize: '12px', padding: '6px 14px', whiteSpace: 'nowrap', borderRadius: '20px' }}
                        >
                            {s.name || '未命名學期'}
                        </button>
                    ))}
                </div>
            )}

            {/* 整體統計卡片 / Overall stats card */}
            {!isLoadingGrades && overallStats && selectedSemester === 'all' && grades.length > 1 && (
                <div className="card" style={{ background: 'linear-gradient(135deg, var(--color-brand-subtle) 0%, rgba(99,102,241,0.06) 100%)' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-brand)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        📊 累計成績總覽
                    </p>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{overallStats.gpa ?? '--'}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>累計 GPA</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{overallStats.avg ?? '--'}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>加權平均</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{overallStats.totalCourses}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>總課程數</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{overallStats.totalCredits}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>總學分</p>
                        </div>
                    </div>
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
                    {filteredGrades.map((semester, idx) => {
                        // 優先使用後端計算的數值，否則前端計算
                        const stats = calculateStats(semester.courses);
                        const gpa = semester.gpa ?? stats.gpa;
                        const weightedAvg = semester.weighted_average ?? stats.weightedAvg;
                        const rank = semester.rank;

                        return (
                            <div key={idx} className="card" style={{ animationDelay: `${idx * 0.08}s` }}>
                                {/* 學期標題 */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <IconBook size={18} style={{ color: 'var(--color-brand)' }} />
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                                            {semester.name || `第 ${idx + 1} 學期`}
                                        </h3>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <span className="badge" style={{ background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 700 }}>
                                            GPA {gpa ?? '--'}
                                        </span>
                                        {weightedAvg && (
                                            <span className="badge" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)', fontWeight: 600 }}>
                                                加權 {weightedAvg}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 排名資訊 */}
                                {rank && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 12px', marginBottom: 12, borderRadius: 10,
                                        background: 'rgba(99,102,241,0.04)', border: '1px solid var(--border-light)',
                                        fontSize: '13px', color: 'var(--text-secondary)',
                                    }}>
                                        🏅 班排名 {rank}
                                    </div>
                                )}

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
                                                <div style={{ display: 'flex', gap: 10, fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    <span>{course.credits || 0} 學分</span>
                                                    {course.grade && <span>{course.grade}</span>}
                                                    {course.course_type && <span>{course.course_type}</span>}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: isNumericCourse(course) ? '1.25rem' : '0.875rem',
                                                fontWeight: isNumericCourse(course) ? 700 : 500,
                                                color: scoreColor(course),
                                                marginLeft: '16px', whiteSpace: 'nowrap',
                                            }}>
                                                {displayScore(course)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* 學期統計 */}
                                <div style={{
                                    marginTop: '14px', paddingTop: '14px',
                                    display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap',
                                    borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)',
                                }}>
                                    <span>共 {(semester.courses || []).length} 門</span>
                                    <span>{(semester.courses || []).reduce((s, c) => s + (c.credits || 0), 0)} 學分</span>
                                    {stats.numericCredits > 0 && stats.numericCredits !== (semester.courses || []).reduce((s, c) => s + (c.credits || 0), 0) && (
                                        <span>計入 GPA: {stats.numericCredits} 學分</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!isLoadingGrades && !filteredGrades.length && !gradesError && (
                <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <IconChartBar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>尚無成績資料</p>
                    <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>
                        請先登入以取得成績
                    </p>
                </div>
            )}
        </div>
    );
}
