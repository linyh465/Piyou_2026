/**
 * 玩課雲頁面 / WOW Class Page
 * 顯示 TronClass 待辦作業，支援忽略功能
 * Shows TronClass pending assignments with ignore support.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useTronclassStore from '../stores/tronclassStore';
import useLangStore from '../stores/langStore';
import useAuthStore from '../stores/authStore';
import {
    IconRefresh, IconChevronRight, IconClock, IconBook,
    IconEyeOff, IconEye, IconCheckCircle,
} from '../components/Icons';

function formatDueDate(dateStr, lang = 'zh-TW') {
    if (!dateStr) return null;
    try {
        return new Date(dateStr).toLocaleDateString(lang, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

// ── 單筆作業列 / Single Assignment Row ──
function AssignmentRow({ assignment, onIgnore, onUnignore, isIgnored, lang }) {
    const { t } = useTranslation('wowClass');
    const isOverdue = assignment.is_overdue;
    const dotColor = isOverdue
        ? 'var(--color-danger)'
        : assignment.is_submitted
            ? 'var(--color-success, #34c759)'
            : 'var(--color-brand)';

    return (
        <div
            className="dash-task-row"
            style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: isIgnored ? 0.55 : 1,
            }}
        >
            {/* 狀態點 / Status dot */}
            <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: dotColor, flexShrink: 0,
            }} />

            {/* 作業資訊 / Assignment info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontSize: '15px', fontWeight: 500, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {assignment.title}
                </p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
                    {assignment.course_name && (
                        <span style={{
                            fontSize: '12px', color: 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', gap: '3px',
                        }}>
                            <IconBook size={11} /> {assignment.course_name}
                        </span>
                    )}
                    {assignment.due_date && (
                        <span style={{
                            fontSize: '12px',
                            color: isOverdue ? 'var(--color-danger)' : 'var(--text-muted)',
                            fontWeight: isOverdue ? 500 : 400,
                            display: 'flex', alignItems: 'center', gap: '3px',
                        }}>
                            <IconClock size={11} />
                            {isOverdue ? `${t('overdue')} · ` : ''}{formatDueDate(assignment.due_date, lang)}
                        </span>
                    )}
                </div>
            </div>

            {/* 忽略/恢復按鈕 / Ignore/unignore button */}
            <button
                type="button"
                onClick={() => isIgnored ? onUnignore(assignment.id) : onIgnore(assignment.id)}
                title={isIgnored ? t('unignore') : t('ignore')}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    borderRadius: '6px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
                {isIgnored ? <IconEye size={16} /> : <IconEyeOff size={16} />}
            </button>
        </div>
    );
}

// ── 主頁面 / Main Page ──
export default function WowClass() {
    const { t } = useTranslation('wowClass');
    const { lang } = useLangStore();
    const fetchAssignments = useTronclassStore((s) => s.fetchAssignments);
    const refresh = useTronclassStore((s) => s.refresh);
    const assignments = useTronclassStore((s) => s.assignments);
    const isLoading = useTronclassStore((s) => s.isLoading);
    const error = useTronclassStore((s) => s.error);
    const fetchedAt = useTronclassStore((s) => s.fetchedAt);
    const ignoredIds = useTronclassStore((s) => s.ignoredIds);
    const ignoreAssignment = useTronclassStore((s) => s.ignoreAssignment);
    const unignoreAssignment = useTronclassStore((s) => s.unignoreAssignment);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    const hasFetched = useRef(false);
    const [showIgnored, setShowIgnored] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!hasFetched.current && isLoggedIn) {
            hasFetched.current = true;
            fetchAssignments();
        }
    }, [fetchAssignments, isLoggedIn]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refresh();
        setIsRefreshing(false);
    };

    const visibleAssignments = assignments.filter((a) => !ignoredIds.has(a.id));
    const ignoredAssignments = assignments.filter((a) => ignoredIds.has(a.id));
    const pendingCount = visibleAssignments.filter((a) => !a.is_submitted).length;
    const overdueCount = visibleAssignments.filter((a) => a.is_overdue).length;

    return (
        <div className="dash-page animate-fade-in">
            {/* ── 頁首 / Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="dash-hero-title">{t('title')}</h1>
                    {fetchedAt && (
                        <p className="dash-hero-date" style={{ fontSize: '12px' }}>
                            {t('syncedAt')} {new Date(fetchedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: '10px', padding: '8px 14px',
                        fontSize: '13px', fontWeight: 500,
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        opacity: (isRefreshing || isLoading) ? 0.5 : 1,
                    }}
                >
                    <IconRefresh size={14} style={{ animation: (isRefreshing || isLoading) ? 'spin 1s linear infinite' : 'none' }} />
                    {t('refresh')}
                </button>
            </div>

            {/* ── 未登入提示 / Not logged in notice ── */}
            {!isLoggedIn && (
                <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔐</p>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{t('notLoggedIn')}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>{t('notLoggedInHint')}</p>
                    <a href="#/settings" style={{
                        display: 'inline-block', marginTop: '14px',
                        padding: '8px 20px', borderRadius: '10px',
                        background: 'var(--color-brand)', color: '#fff',
                        fontSize: '14px', fontWeight: 500, textDecoration: 'none',
                    }}>
                        {t('goToSettings')}
                    </a>
                </div>
            )}

            {/* ── 載入中 / Loading ── */}
            {isLoggedIn && isLoading && !assignments.length && (
                <div className="card" style={{ padding: '28px 24px' }}>
                    <div className="skeleton" style={{ height: '14px', width: '120px', marginBottom: '12px', borderRadius: '8px' }} />
                    <div className="skeleton" style={{ height: '14px', width: '200px', marginBottom: '8px', borderRadius: '8px' }} />
                    <div className="skeleton" style={{ height: '14px', width: '160px', borderRadius: '8px' }} />
                </div>
            )}

            {/* ── 錯誤提示 / Error notice ── */}
            {error && (
                <div className="card" style={{ padding: '16px 20px', background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-danger)', fontWeight: 500 }}>⚠️ {error}</p>
                </div>
            )}

            {/* ── 摘要統計 / Summary stats ── */}
            {isLoggedIn && !isLoading && assignments.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="card" style={{ flex: 1, minWidth: '120px', padding: '16px 18px' }}>
                        <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{pendingCount}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('pendingCount')}</p>
                    </div>
                    {overdueCount > 0 && (
                        <div className="card" style={{ flex: 1, minWidth: '120px', padding: '16px 18px', background: 'rgba(255,59,48,0.05)', border: '1px solid rgba(255,59,48,0.15)' }}>
                            <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-danger)', lineHeight: 1 }}>{overdueCount}</p>
                            <p style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: '4px', fontWeight: 500 }}>{t('overdueCount')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── 待提交作業列表 / Pending assignments list ── */}
            {isLoggedIn && !isLoading && (
                <div className="dash-section">
                    <h3 className="dash-section-title">{t('pendingAssignments')}</h3>

                    {visibleAssignments.length === 0 ? (
                        <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🎉</p>
                            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {t('allDone')}
                            </p>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            {visibleAssignments.map((a, i) => (
                                <div key={a.id} style={{ borderBottom: i < visibleAssignments.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                    <AssignmentRow
                                        assignment={a}
                                        isIgnored={false}
                                        onIgnore={ignoreAssignment}
                                        onUnignore={unignoreAssignment}
                                        lang={lang}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── 已忽略作業 / Ignored assignments ── */}
            {isLoggedIn && ignoredAssignments.length > 0 && (
                <div className="dash-section">
                    <button
                        type="button"
                        onClick={() => setShowIgnored((v) => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 0, color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600,
                        }}
                    >
                        <span className="dash-section-title" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                            {t('ignoredAssignments')} ({ignoredAssignments.length})
                        </span>
                        <IconChevronRight size={14} style={{
                            transition: 'transform 0.2s',
                            transform: showIgnored ? 'rotate(90deg)' : 'rotate(0deg)',
                        }} />
                    </button>

                    {showIgnored && (
                        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '8px' }}>
                            {ignoredAssignments.map((a, i) => (
                                <div key={a.id} style={{ borderBottom: i < ignoredAssignments.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                    <AssignmentRow
                                        assignment={a}
                                        isIgnored={true}
                                        onIgnore={ignoreAssignment}
                                        onUnignore={unignoreAssignment}
                                        lang={lang}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 全部完成且無忽略 / All done and no ignored */}
            {isLoggedIn && !isLoading && assignments.length === 0 && !error && (
                <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📚</p>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {t('noAssignments')}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {t('noAssignmentsHint')}
                    </p>
                </div>
            )}
        </div>
    );
}
