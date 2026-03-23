/**
 * 成績頁面 / Grades Page — iOS 風格
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import useTimetableStore from '../stores/timetableStore';
import { IconChartBar, IconRefresh, IconBook, IconTrash, IconUser, IconDotsVertical, IconXCircle } from '../components/Icons';
import SyncLoginModal from '../components/SyncLoginModal';
import { scoreToGPA } from '../utils/scoreToGPA';

/** 科目詳細 Modal / Course detail centered dialog */
function CourseDetailModal({ course, onClose }) {
    if (!course) return null;
    const gpa = isNumericCourse(course) ? scoreToGPA(course.score) : null;
    const rows = [
        course.score != null && { label: '分數', value: displayScore(course), highlight: true },
        course.grade && { label: '等第', value: course.grade },
        gpa != null && { label: 'GPA', value: gpa.toFixed(1) },
        course.credits != null && { label: '學分', value: `${course.credits} 學分` },
        course.course_type && { label: '修別', value: course.course_type },
    ].filter(Boolean);
    return createPortal(
        <>
            {/* 背景遮罩 */}
            <div onClick={onClose} style={{
                position: 'fixed', inset: 0, zIndex: 900,
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            }} />
            {/* 置中卡片 */}
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 901,
                width: 'min(360px, calc(100vw - 32px))',
                background: 'var(--bg-card)',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                maxHeight: '80vh', overflowY: 'auto',
                animation: 'gradeModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
                {/* 標題列 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div style={{ flex: 1, marginRight: '12px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>{course.name}</h3>
                        {course.course_type && (
                            <span className={`grade-type-badge ${course.course_type === '必修' ? 'required' : ''}`} style={{ marginTop: '8px', display: 'inline-block' }}>
                                {course.course_type}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }}>
                        <IconXCircle size={22} />
                    </button>
                </div>
                {/* 資料列 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {rows.map(({ label, value, highlight }) => (
                        <div key={label} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            paddingBottom: '14px', borderBottom: '1px solid var(--border-light)',
                        }}>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{label}</span>
                            <span style={{
                                fontSize: highlight ? '2rem' : '15px',
                                fontWeight: highlight ? 800 : 600,
                                color: highlight ? scoreColor(course) : 'var(--text)',
                                letterSpacing: highlight ? '-0.02em' : 0,
                            }}>{value}</span>
                        </div>
                    ))}
                </div>
            </div>
            <style>{`
                @keyframes gradeModalIn {
                    from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)) scale(0.95); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
            `}</style>
        </>,
        document.body
    );
}

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
    return course.score >= 60 ? 'var(--color-success)' : 'var(--color-danger)';
}

function displayScore(course) {
    if (course.score_text) return course.score_text;
    if (course.score != null) return course.score;
    return '--';
}

function parseRank(rankStr) {
    if (!rankStr || typeof rankStr !== 'string') return null;
    const parts = rankStr.split('/');
    if (parts.length !== 2) return null;
    const rank = parseInt(parts[0], 10);
    const total = parseInt(parts[1], 10);
    if (isNaN(rank) || isNaN(total) || total === 0) return null;
    return { rank, total };
}

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
                    strokeDasharray={circumference} strokeDashoffset={offset}
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

function AvgGauge({ avg, label }) {
    const numAvg = parseFloat(avg) || 0;
    const ratio = Math.min(numAvg / 100, 1);
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - ratio * circumference;
    const color = numAvg >= 80 ? 'var(--color-success)' : numAvg >= 60 ? 'var(--color-brand)' : 'var(--color-warning)';

    return (
        <div className="gpa-gauge">
            <svg viewBox="0 0 120 120" className="gpa-gauge-svg">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div className="gpa-gauge-text">
                <span className="gpa-gauge-value">{avg ?? '--'}</span>
                <span className="gpa-gauge-label">{label}</span>
            </div>
        </div>
    );
}

function RankBar({ label, rank, total }) {
    if (!rank || !total) return null;
    const pct = ((rank / total) * 100).toFixed(2);
    const fillPct = Math.min((1 - rank / total) * 100 + 5, 100);
    return (
        <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>{pct}%</span>
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
    const { t } = useTranslation('grades');
    const { t: tCommon } = useTranslation('common');
    const { grades, isLoadingGrades, gradesError, fetchGrades, clearGradesData, canSync } = useTimetableStore();
    const [selectedSemester, setSelectedSemester] = useState(null);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!showMenu) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMenu]);

    const activeSemester = selectedSemester || (grades.length ? grades[0].name : null);
    const currentSem = grades.find(s => s.name === activeSemester) || grades[0];

    const handleClearGrades = async () => {
        const syncCheck = await canSync();
        let msg = t('clearConfirm');
        if (!syncCheck.allowed) {
            const mins = Math.ceil((syncCheck.remainingMs || 0) / 60000);
            msg += `\n\n${t('cooldownWarning', { mins })}`;
        }
        if (window.confirm(msg)) clearGradesData();
    };

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

    const classRankParsed = parseRank(currentSem?.class_rank) ?? parseRank(currentSem?.rank);
    const deptRankParsed = parseRank(currentSem?.dept_rank);

    return (
        <div className="section-stack animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <IconChartBar size={22} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <h1 className="dash-hero-title" style={{ paddingBottom: 0 }}>{t('title')}</h1>
                </div>
                <div className="page-menu-wrapper" style={{ paddingTop: '6px' }} ref={menuRef}>
                    <div className="page-header-actions">
                        <button onClick={() => setShowSyncModal(true)} className="btn btn-soft" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconUser size={14} /> {tCommon('signIn')}
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
                    <button className="page-header-menu-btn" onClick={() => setShowMenu(v => !v)} aria-label={tCommon('moreActions')}>
                        <IconDotsVertical size={18} />
                    </button>
                    {showMenu && (
                        <div className="page-menu-dropdown">
                            <button onClick={() => { setShowSyncModal(true); setShowMenu(false); }} className="btn btn-soft">
                                <IconUser size={14} /> {tCommon('signIn')}
                            </button>
                            <button onClick={() => { fetchGrades(); setShowMenu(false); }} disabled={isLoadingGrades} className="btn btn-ghost">
                                <IconRefresh size={14} className={isLoadingGrades ? 'animate-spin' : ''} /> {tCommon('refresh')}
                            </button>
                            {grades.length > 0 && (
                                <button onClick={() => { handleClearGrades(); setShowMenu(false); }} className="btn btn-ghost" style={{ color: 'var(--color-danger)' }}>
                                    <IconTrash size={14} /> {tCommon('clear')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {gradesError && (
                <div className="card" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245,158,11,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-warning)' }}>⚠️ {gradesError}</p>
                </div>
            )}

            {!isLoadingGrades && grades.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {grades.map((s) => (
                        <button
                            key={s.name}
                            onClick={() => setSelectedSemester(s.name)}
                            className={`grade-sem-tab ${activeSemester === s.name ? 'active' : ''}`}
                        >
                            {s.name || t('unnamed')}
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
                    <div className="card">
                        <div className="grade-overview" style={{ flexDirection: 'column', alignItems: 'center' }}>
                            <div className="grade-gauges-row">
                                <GpaGauge gpa={overallStats?.gpa ?? semGpa} label={t('overallGpa')} />
                                {semAvg && <AvgGauge avg={semAvg} label={t('weightedAvg')} />}
                            </div>
                            <div style={{ display: 'flex', gap: '24px', width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('classRank')}</span>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                                        {classRankParsed?.rank ?? '--'}<span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}> / {classRankParsed?.total ?? '--'}</span>
                                    </p>
                                    {classRankParsed && (
                                        <p style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 600 }}>
                                            {((classRankParsed.rank / classRankParsed.total) * 100).toFixed(2)}%
                                        </p>
                                    )}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('deptRank')}</span>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                                        {deptRankParsed?.rank ?? '--'}<span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}> / {deptRankParsed?.total ?? '--'}</span>
                                    </p>
                                    {deptRankParsed && (
                                        <p style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 600 }}>
                                            {((deptRankParsed.rank / deptRankParsed.total) * 100).toFixed(2)}%
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{t('courseGrades')}</h3>
                        </div>
                        {(currentSem.courses || []).map((course, ci) => (
                            <div
                                key={ci}
                                className="grade-course-row"
                                onClick={() => setSelectedCourse(course)}
                                style={{ borderBottom: ci < (currentSem.courses || []).length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer' }}
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
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {t('credits', { n: course.credits || 0 })}
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
                                </div>
                            </div>
                        ))}
                    </div>

                </>
            ) : (
                <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <IconChartBar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{t('noGrades')}</p>
                    <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>{t('noGradesHint')}</p>
                </div>
            )}

            {/* 免責聲明 / Disclaimer */}
            <div style={{
                background: 'var(--bg-secondary)', borderRadius: '12px',
                padding: '14px 18px', marginTop: '4px',
            }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.6' }}>
                    此成績頁面僅供參考，請以<strong>綜合業務組</strong>為準。
                </p>
            </div>

            <SyncLoginModal show={showSyncModal} onClose={() => setShowSyncModal(false)} />
            <CourseDetailModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />
        </div>
    );
}
