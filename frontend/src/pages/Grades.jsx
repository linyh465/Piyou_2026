/**
 * 成績頁面 / Grades Page — iOS 風格
 * 圓形 GPA 儀錶、排名進度條、課程成績列表
 */
import { useState } from 'react';
import useTimetableStore from '../stores/timetableStore';
import { IconChartBar, IconRefresh, IconBook, IconTrash, IconUser } from '../components/Icons';
import SyncLoginModal from '../components/SyncLoginModal';
import { scoreToGPA } from '../utils/scoreToGPA';

function isNumericCourse(course) {
    return course.score != null && course.score_text == null;
}

function calculateStats(courses) {
    const numeric = (courses || []).filter(isNumericCourse);
    if (!numeric.length) return { gpa: null, weightedAvg: null, numericCredits: 0 };
    let totalWeighted = 0, totalGPA = 0, credits = 0;
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

// ── 圓形 GPA 儀錶 / Circular GPA Gauge ──
function GpaGauge({ gpa, label }) {
    const numGpa = parseFloat(gpa) || 0;
    const ratio = Math.min(numGpa / 4.3, 1);
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - ratio * circumference;
    const color = numGpa >= 3.5 ? 'var(--color-success)' : numGpa >= 2.5 ? 'var(--color-brand)' : 'var(--color-warning)';

    return (
        <div className="gpa-gauge">
            <svg viewBox="0 0 120 120" className="gpa-gauge-svg">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div className="gpa-gauge-text">
                <span className="gpa-gauge-value">{gpa ?? '--'}</span>
                <span className="gpa-gauge-label">{label}</span>
            </div>
        </div>
    );
}

// ── 排名進度條 / Rank Progress Bar ──
function RankBar({ label, rank, total }) {
    if (!rank || !total) return null;
    const pct = ((rank / total) * 100).toFixed(1);
    const fillPct = Math.min((1 - rank / total) * 100 + 5, 100); // 越前面越多
    return (
        <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>Top {pct}%</span>
            </div>
            <div className="rank-bar-track">
                <div className="rank-bar-fill" style={{ width: `${fillPct}%` }} />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                {rank} / {total}
            </p>
        </div>
    );
}

export default function Grades() {
    const { grades, isLoadingGrades, gradesError, fetchGrades, clearGradesData, canSync } = useTimetableStore();
    const [selectedSemester, setSelectedSemester] = useState(null);
    const [showSyncModal, setShowSyncModal] = useState(false);

    // 預設選第一個學期
    const activeSemester = selectedSemester || (grades.length ? grades[0].name : null);
    const currentSem = grades.find(s => s.name === activeSemester) || grades[0];

    const handleClearGrades = async () => {
        const syncCheck = await canSync();
        let msg = '確定要清除成績資料嗎？';
        if (!syncCheck.allowed) {
            const mins = Math.ceil((syncCheck.remainingMs || 0) / 60000);
            msg += `\n\n⚠️ 冷卻時間: ${mins}分，需待冷卻結束後才可再次同步校園資料。`;
        }
        if (window.confirm(msg)) clearGradesData();
    };

    // 整體累計 GPA
    const overallStats = (() => {
        if (!grades.length) return null;
        const allNumeric = grades.flatMap(s => (s.courses || []).filter(isNumericCourse));
        if (!allNumeric.length) return null;
        let totalGPA = 0, credits = 0;
        for (const c of allNumeric) {
            const cr = c.credits || 0;
            totalGPA += scoreToGPA(c.score || 0) * cr;
            credits += cr;
        }
        return { gpa: credits ? (totalGPA / credits).toFixed(2) : null };
    })();

    const semStats = currentSem ? calculateStats(currentSem.courses) : {};
    const semGpa = currentSem?.gpa ?? semStats.gpa;
    const semAvg = currentSem?.weighted_average ?? semStats.weightedAvg;

    // 排名
    const classRank = currentSem?.class_rank ?? currentSem?.rank;
    const classTotal = currentSem?.class_total ?? 45;
    const deptRank = currentSem?.dept_rank;
    const deptTotal = currentSem?.dept_total ?? 180;

    return (
        <div className="section-stack animate-fade-in">
            {/* 標題 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h1 className="dash-hero-title" style={{ paddingBottom: 0 }}>成績查詢</h1>
                <div style={{ display: 'flex', gap: '8px', paddingTop: '6px' }}>
                    <button onClick={() => setShowSyncModal(true)} className="btn btn-soft" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconUser size={14} /> 一鍵登入
                    </button>
                    <button onClick={fetchGrades} disabled={isLoadingGrades} className="btn btn-ghost" style={{ fontSize: '13px' }}>
                        <IconRefresh size={15} className={isLoadingGrades ? 'animate-spin' : ''} />
                    </button>
                    {grades.length > 0 && (
                        <button onClick={handleClearGrades} className="btn btn-ghost" style={{ fontSize: '13px', color: 'var(--color-danger)' }}>
                            <IconTrash size={15} />
                        </button>
                    )}
                </div>
            </div>

            {gradesError && (
                <div className="card" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245,158,11,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-warning)' }}>⚠️ {gradesError}</p>
                </div>
            )}

            {/* 學期選擇 */}
            {!isLoadingGrades && grades.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {grades.map((s) => (
                        <button
                            key={s.name}
                            onClick={() => setSelectedSemester(s.name)}
                            className={`grade-sem-tab ${activeSemester === s.name ? 'active' : ''}`}
                        >
                            {s.name || '未命名'}
                        </button>
                    ))}
                </div>
            )}

            {isLoadingGrades ? (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', padding: '40px' }}>
                    <div className="skeleton" style={{ width: 120, height: 120, borderRadius: '50%' }} />
                    <div className="skeleton" style={{ height: 20, width: 160 }} />
                </div>
            ) : currentSem ? (
                <>
                    {/* GPA 與排名卡片 */}
                    <div className="card">
                        <div className="grade-overview">
                            <GpaGauge gpa={overallStats?.gpa ?? semGpa} label="歷年 GPA" />
                            <div className="grade-rank-section">
                                <div className="grade-rank-item">
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>班級排名</span>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                                        {classRank ?? '--'}<span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>/ {classTotal}</span>
                                    </p>
                                </div>
                                <div className="grade-rank-item">
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>系所排名</span>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                                        {deptRank ?? '--'}<span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>/ {deptTotal}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 成績排名進度條 */}
                    <div className="card">
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text)' }}>成績排名</h3>
                        <RankBar label="班級排名" rank={classRank} total={classTotal} />
                        <RankBar label="系所排名" rank={deptRank} total={deptTotal} />
                    </div>

                    {/* 修課成績列表 */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>修課成績</h3>
                            {semAvg && (
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>平均 {semAvg}</span>
                            )}
                        </div>
                        {(currentSem.courses || []).map((course, ci) => (
                            <div
                                key={ci}
                                className="grade-course-row"
                                style={{
                                    borderBottom: ci < (currentSem.courses || []).length - 1 ? '1px solid var(--border-light)' : 'none',
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {course.name}
                                        </p>
                                        {course.course_type && (
                                            <span className={`grade-type-badge ${course.course_type === '必修' ? 'required' : ''}`}>
                                                {course.course_type}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {course.credits || 0} 學分
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <span style={{
                                        fontSize: isNumericCourse(course) ? '1.25rem' : '0.875rem',
                                        fontWeight: isNumericCourse(course) ? 700 : 500,
                                        color: scoreColor(course),
                                    }}>
                                        {displayScore(course)}
                                    </span>
                                    {isNumericCourse(course) && course.score >= 60 && (
                                        <span style={{ fontSize: '12px', color: 'var(--color-success)', marginLeft: '4px' }}>✓</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <IconChartBar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>尚無成績資料</p>
                    <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>請先登入以取得成績</p>
                </div>
            )}

            {/* 同步登入 Modal */}
            <SyncLoginModal show={showSyncModal} onClose={() => setShowSyncModal(false)} />
        </div>
    );
}
