/**
 * 同步校園資料 Modal / Sync Campus Data Modal
 * 可重用的登入同步元件，供課表、成績、圖書館等頁面使用
 * Reusable login & sync modal for Timetable, Grades, Library pages.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../stores/authStore';
import useTimetableStore from '../stores/timetableStore';
import useTaskStore from '../stores/taskStore';
import useLibraryStore from '../stores/libraryStore';

export default function SyncLoginModal({ show, onClose }) {
    const { t } = useTranslation('common');
    const { login, error, clearError } = useAuthStore();
    const {
        fetchTimetable, fetchGrades, canSync,
        recordSyncSuccess, recordSyncError, serverCooldown,
    } = useTimetableStore();
    const { fetchLibrary } = useLibraryStore();
    const { syncTasksFromServer, syncTasksToServer } = useTaskStore();

    const [studentId, setStudentId] = useState('');
    const [password, setPassword] = useState('');
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // show 切換為 true 時重置成功狀態（React 建議的 render 時調整 state 模式）
    const [prevShow, setPrevShow] = useState(false);
    if (show !== prevShow) {
        setPrevShow(show);
        if (show) {
            setSyncSuccess(false);
        }
    }

    useEffect(() => {
        if (show) {
            canSync();
            clearError();
        }
    }, [show, canSync, clearError]);

    if (!show) return null;

    const handleSync = async (e) => {
        e.preventDefault();
        if (!studentId.trim() || !password.trim() || isSyncing) return;

        setIsSyncing(true);
        setSyncSuccess(false);

        try {
            const syncCheck = await canSync();
            if (!syncCheck.allowed) {
                setIsSyncing(false);
                return;
            }

            const success = await login(studentId.trim(), password);
            if (success) {
                await fetchTimetable();
                await fetchGrades();
                await fetchLibrary();
                await syncTasksFromServer();
                await syncTasksToServer();
                recordSyncSuccess();
                setSyncSuccess(true);
                setTimeout(() => {
                    onClose();
                    setPassword('');
                    setSyncSuccess(false);
                    setIsSyncing(false);
                }, 1500);
            } else {
                recordSyncError();
                setIsSyncing(false);
            }
        } catch {
            setIsSyncing(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px', background: 'rgba(0,0,0,0.5)',
            }}
            className="animate-fade-in"
        >
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                    {t('syncPortalTitle')}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {t('syncPortalBody')}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    {t('syncSecureNote')}
                </p>

                {serverCooldown && !serverCooldown.allowed && (() => {
                    const mins = Math.ceil((serverCooldown.remainingMs || 0) / 60000);
                    return (
                        <div style={{
                            padding: '12px', borderRadius: '10px', marginBottom: '12px',
                            background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)', fontSize: '14px',
                        }}>
                            {serverCooldown.reason === 'locked'
                                ? t('syncCooldownLocked', { mins })
                                : t('syncCooldownWait', { mins })}
                        </div>
                    );
                })()}

                {error && (
                    <div style={{
                        padding: '12px', borderRadius: '10px', marginBottom: '12px',
                        background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', fontSize: '14px',
                    }}>
                        {error}
                    </div>
                )}
                {syncSuccess && (
                    <div style={{
                        padding: '12px', borderRadius: '10px', marginBottom: '12px',
                        background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '14px',
                    }}>
                        {t('syncSuccess')}
                    </div>
                )}

                <form onSubmit={handleSync}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                            type="text"
                            placeholder={t('studentId')}
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            className="input"
                            style={{ padding: '12px 16px', fontSize: '15px' }}
                            aria-label={t('studentId')}
                            autoComplete="username"
                        />
                        <input
                            type="password"
                            placeholder={t('password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input"
                            style={{ padding: '12px 16px', fontSize: '15px' }}
                            aria-label={t('password')}
                            autoComplete="current-password"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSyncing}
                            className="btn btn-ghost"
                            style={{ flex: 1, padding: '12px', fontSize: '15px' }}
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={isSyncing || !studentId.trim() || !password.trim() || (serverCooldown && !serverCooldown.allowed)}
                            className="btn btn-primary"
                            style={{
                                flex: 1, padding: '12px', fontSize: '15px',
                                opacity: (isSyncing || !studentId.trim() || !password.trim() || (serverCooldown && !serverCooldown.allowed)) ? 0.5 : 1,
                            }}
                        >
                            {isSyncing ? t('syncing') : (serverCooldown && !serverCooldown.allowed) ? t('unavailable') : t('sync')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
