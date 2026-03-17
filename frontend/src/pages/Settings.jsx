/**
 * 設定頁面 / Settings Page
 * 帳戶管理、外觀主題切換、語言選擇、通知偏好
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import useThemeStore from '../stores/themeStore';
import { COLOR_THEMES } from '../stores/themeStore';
import useAuthStore from '../stores/authStore';
import useTimetableStore from '../stores/timetableStore';
import useTaskStore from '../stores/taskStore';
import useLibraryStore from '../stores/libraryStore';
import useLangStore, { LANGUAGES } from '../stores/langStore';
import {
    IconUser, IconSun, IconBell, IconSettings,
    IconLogOut, IconChevronRight, IconBook, IconCheckCircle, IconXCircle
} from '../components/Icons';

// ── 設定項目元件 / Setting Item Component ──
function SettingItem({ icon: Icon, label, labelEn, children, onClick }) {
    return (
        <div
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-label={onClick ? label : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 8px',
                borderBottom: '1px solid var(--border-light)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {Icon && <Icon size={20} style={{ color: 'var(--text-muted)' }} />}
                <div>
                    <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: 500 }}>{label}</p>
                    {labelEn && <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{labelEn}</p>}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {children}
                {onClick && <IconChevronRight size={18} style={{ color: 'var(--text-muted)' }} />}
            </div>
        </div>
    );
}

// ── 開關元件 / Toggle Switch ──
function Toggle({ checked, onChange, 'aria-label': ariaLabel }) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
            style={{
                position: 'relative', width: '44px', height: '24px',
                borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: checked ? 'var(--color-brand)' : 'var(--border)',
                transition: 'background 0.2s',
            }}
        >
            <span style={{
                position: 'absolute', top: '2px', left: '2px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'white',
                transition: 'transform 0.2s',
                transform: checked ? 'translateX(20px)' : 'translateX(0)',
            }} />
        </button>
    );
}

// ── 行內下拉選單 / Inline Select ──
function InlineSelect({ value, onChange, options }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
                background: 'var(--bg-input)',
                color: 'var(--text)',
                border: '1.5px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '140px',
            }}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    );
}

// ── 段落標題 / Section Header ──
function SectionHeader({ title }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                {title}
            </h3>
        </div>
    );
}

export default function Settings() {
    const { t } = useTranslation('settings');
    const { t: tCommon } = useTranslation('common');
    const { theme, setTheme, colorTheme, setColorTheme } = useThemeStore();
    const { user, isAuthenticated, login, logout, error, clearError } = useAuthStore();
    const { fetchTimetable, fetchGrades, canSync, recordSyncSuccess, recordSyncError, hasCachedData, lastSyncTime, clearSchoolData, serverCooldown } = useTimetableStore();
    const { syncTasksFromServer, syncTasksToServer } = useTaskStore();
    const { clearLibraryData } = useLibraryStore();
    const { lang, setLang } = useLangStore();

    const [busNotify, setBusNotify] = useState(() => {
        try { return JSON.parse(localStorage.getItem('piyou_busNotify') ?? 'true'); } catch { return true; }
    });
    const [taskNotify, setTaskNotify] = useState(() => {
        try { return JSON.parse(localStorage.getItem('piyou_taskNotify') ?? 'true'); } catch { return true; }
    });

    useEffect(() => { localStorage.setItem('piyou_busNotify', JSON.stringify(busNotify)); }, [busNotify]);
    useEffect(() => { localStorage.setItem('piyou_taskNotify', JSON.stringify(taskNotify)); }, [taskNotify]);

    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const scrollToTop = () => {
        const main = document.querySelector('.sidebar-main');
        if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const [studentId, setStudentId] = useState('');
    const [password, setPassword] = useState('');
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (showSyncModal) { canSync(); }
    }, [showSyncModal, canSync]);

    const handleSync = async (e) => {
        e.preventDefault();
        setSyncSuccess(false);
        if (!studentId.trim() || !password.trim()) return;
        if (isSyncing) return;
        setIsSyncing(true);

        try {
            const syncCheck = await canSync();
            if (!syncCheck.allowed) { setIsSyncing(false); return; }

            const success = await login(studentId.trim(), password);
            if (success) {
                // 課表與成績互不相依，並行抓取以加速同步
                // Timetable and grades are independent — fetch in parallel
                await Promise.all([
                    fetchTimetable(),
                    fetchGrades(),
                ]);
                // 任務：先上傳再下載（有順序相依）
                // Tasks: upload then download (order matters)
                await syncTasksToServer();
                await syncTasksFromServer();
                recordSyncSuccess();
                setSyncSuccess(true);
                setTimeout(() => {
                    setShowSyncModal(false);
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

    const handleLogout = () => {
        setShowLogoutConfirm(true);
        scrollToTop();
    };

    const confirmLogout = () => {
        logout();
        clearSchoolData();
        clearLibraryData();
        window.location.reload();
    };

    const themeOptions = [
        { value: 'light',  label: `☀️ ${t('theme.light')}` },
        { value: 'dark',   label: `🌙 ${t('theme.dark')}` },
        { value: 'system', label: `⚙️ ${t('theme.system')}` },
    ];

    const colorOptions = COLOR_THEMES.map((ct) => ({
        value: ct.id,
        label: `${ct.label} · ${ct.labelEn}`,
    }));

    const langOptions = LANGUAGES.map((l) => ({
        value: l.code,
        label: `${l.flag} ${l.label}`,
    }));

    return (
        <div className="section-stack animate-fade-in">
            {/* ── 標題 / Header ── */}
            <div style={{ paddingBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <IconSettings size={24} style={{ color: 'var(--text-muted)' }} />
                    <h2 style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                        {t('title')}
                    </h2>
                </div>
            </div>

            {/* ═══ 帳戶 / Account ═══ */}
            <div className="card-stack">
                <SectionHeader title={t('account')} />
                <div className="card">
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '16px',
                        paddingBottom: '16px', padding: '4px 8px 16px',
                        borderBottom: '1px solid var(--border-light)',
                    }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--color-brand)', color: 'white', flexShrink: 0,
                        }}>
                            <IconUser size={28} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1.125rem' }}>
                                {isAuthenticated && user ? user.name : tCommon('helloStudent')}
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {hasCachedData() ? (
                                    <>
                                        <IconCheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                                        <span>{tCommon('syncedData')}</span>
                                        {lastSyncTime > 0 && (
                                            <span style={{ fontSize: '12px' }}>
                                                ({new Date(lastSyncTime).toLocaleString(lang)})
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <IconXCircle size={14} />
                                        <span>{tCommon('notSyncedData')}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <div style={{ paddingTop: '4px' }}>
                        <SettingItem
                            icon={IconBook}
                            label={t('syncPortal')}
                            labelEn={t('syncPortalDesc')}
                            onClick={() => { clearError(); setShowSyncModal(true); setSyncSuccess(false); scrollToTop(); }}
                        />
                        {(isAuthenticated || localStorage.getItem('piyou_timetable')) && (
                            <SettingItem icon={IconLogOut} label={t('signOut')} labelEn={t('signOutDesc')} onClick={handleLogout} />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Sync Data Modal ── */}
            {showSyncModal && createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', background: 'rgba(0,0,0,0.5)',
                }} className="animate-fade-in">
                    <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                            {t('syncModalTitle')}
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            {t('syncModalBody')}
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            {tCommon('syncSecureNote')}
                        </p>

                        {serverCooldown && !serverCooldown.allowed && (() => {
                            const mins = Math.ceil((serverCooldown.remainingMs || 0) / 60000);
                            return (
                                <div style={{
                                    padding: '12px', borderRadius: '10px', marginBottom: '12px',
                                    background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)', fontSize: '14px',
                                }}>
                                    {serverCooldown.reason === 'locked'
                                        ? tCommon('syncCooldownLocked', { mins })
                                        : tCommon('syncCooldownWait', { mins })}
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
                                {tCommon('syncSuccess')}
                            </div>
                        )}

                        <form onSubmit={handleSync}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input
                                    type="text"
                                    placeholder={tCommon('studentId')}
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="input"
                                    style={{ padding: '12px 16px', fontSize: '15px' }}
                                    aria-label={tCommon('studentId')}
                                    autoComplete="username"
                                />
                                <input
                                    type="password"
                                    placeholder={tCommon('password')}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input"
                                    style={{ padding: '12px 16px', fontSize: '15px' }}
                                    aria-label={tCommon('password')}
                                    autoComplete="current-password"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowSyncModal(false)}
                                    disabled={isSyncing}
                                    className="btn btn-ghost"
                                    style={{ flex: 1, padding: '12px', fontSize: '15px' }}
                                >
                                    {tCommon('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSyncing || !studentId.trim() || !password.trim() || (serverCooldown && !serverCooldown.allowed)}
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '12px', fontSize: '15px', opacity: (isSyncing || !studentId.trim() || !password.trim() || (serverCooldown && !serverCooldown.allowed)) ? 0.5 : 1 }}
                                >
                                    {isSyncing ? tCommon('syncing') : (serverCooldown && !serverCooldown.allowed) ? tCommon('unavailable') : t('syncPortal')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Logout Confirmation Modal ── */}
            {showLogoutConfirm && createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', background: 'rgba(0,0,0,0.5)',
                }} className="animate-fade-in">
                    <div className="card" style={{ width: '100%', maxWidth: '380px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                            {t('confirmLogoutTitle')}
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
                            {t('confirmLogoutDesc')}
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(false)}
                                className="btn btn-ghost"
                                style={{ flex: 1, padding: '12px', fontSize: '15px' }}
                            >
                                {tCommon('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={confirmLogout}
                                className="btn"
                                style={{
                                    flex: 1, padding: '12px', fontSize: '15px',
                                    background: 'var(--color-danger)', color: 'white',
                                    border: 'none', borderRadius: '10px', cursor: 'pointer',
                                }}
                            >
                                {t('confirmLogoutTitle')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ═══ 外觀 / Appearance ═══ */}
            <div className="card-stack">
                <SectionHeader title={t('appearance')} />
                <div className="card">
                    <SettingItem icon={IconSun} label={t('themeMode')}>
                        <InlineSelect value={theme} onChange={setTheme} options={themeOptions} />
                    </SettingItem>
                    <SettingItem icon={IconSettings} label={t('colorTheme')}>
                        <InlineSelect value={colorTheme} onChange={setColorTheme} options={colorOptions} />
                    </SettingItem>
                    <SettingItem icon={IconBook} label={t('language')}>
                        <InlineSelect value={lang} onChange={setLang} options={langOptions} />
                    </SettingItem>
                </div>
            </div>

            {/* ═══ 通知 / Notifications ═══ */}
            <div className="card-stack">
                <SectionHeader title={t('notifications')} />
                <div className="card">
                    <SettingItem icon={IconBell} label={t('busAlerts')} labelEn={t('busAlertsDesc')}>
                        <Toggle checked={busNotify} onChange={setBusNotify} aria-label={t('busAlerts')} />
                    </SettingItem>
                    <SettingItem icon={IconBell} label={t('taskReminders')} labelEn={t('taskRemindersDesc')}>
                        <Toggle checked={taskNotify} onChange={setTaskNotify} aria-label={t('taskReminders')} />
                    </SettingItem>
                </div>
            </div>

            {/* ═══ 關於 / About ═══ */}
            <div className="card-stack">
                <SectionHeader title={t('about')} />
                <div className="card">
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 8px',
                    }}>
                        <span style={{ color: 'var(--text)', fontSize: '15px', fontWeight: 500 }}>{t('version')}</span>
                        <span style={{
                            fontFamily: 'monospace', padding: '4px 10px', borderRadius: '6px',
                            background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '14px',
                        }}>1.0.0-beta</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
