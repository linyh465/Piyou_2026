/**
 * 設定頁面 / Settings Page
 * 帳戶管理、外觀主題切換、通知偏好
 * Account management, appearance theme toggle, notification prefs.
 *
 * 排版間距與字體大小統一與首頁 Dashboard 一致
 * Layout spacing and font sizes unified with Dashboard.
 */
import { useState, useEffect } from 'react';
import useThemeStore from '../stores/themeStore';
import { COLOR_THEMES } from '../stores/themeStore';
import useAuthStore from '../stores/authStore';
import useTimetableStore from '../stores/timetableStore';
import useTaskStore from '../stores/taskStore';
import useLibraryStore from '../stores/libraryStore';
import {
    IconUser, IconSun, IconMoon, IconBell, IconSettings,
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

// ── 段落標題 / Section Header ──
function SectionHeader({ title, titleEn }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                {title} <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>{titleEn}</span>
            </h3>
        </div>
    );
}

export default function Settings() {
    const { theme, setTheme, colorTheme, setColorTheme } = useThemeStore();
    const { user, isAuthenticated, login, logout, error, clearError } = useAuthStore();
    const { fetchTimetable, fetchGrades, canSync, recordSyncSuccess, recordSyncError, hasCachedData, lastSyncTime, clearSchoolData, serverCooldown } = useTimetableStore();
    const { syncTasksFromServer, syncTasksToServer } = useTaskStore();
    const { clearLibraryData } = useLibraryStore();

    const [busNotify, setBusNotify] = useState(() => {
        try { return JSON.parse(localStorage.getItem('piyou_busNotify') ?? 'true'); } catch { return true; }
    });
    const [taskNotify, setTaskNotify] = useState(() => {
        try { return JSON.parse(localStorage.getItem('piyou_taskNotify') ?? 'true'); } catch { return true; }
    });

    // 持久化通知偏好至 localStorage / Persist notification prefs
    useEffect(() => { localStorage.setItem('piyou_busNotify', JSON.stringify(busNotify)); }, [busNotify]);
    useEffect(() => { localStorage.setItem('piyou_taskNotify', JSON.stringify(taskNotify)); }, [taskNotify]);

    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // 開啟彈窗時將捲動容器滾到頂部，確保手機版使用者能看到彈窗
    // Scroll the main container to top when opening modals so mobile users can see them
    const scrollToTop = () => {
        const main = document.querySelector('.sidebar-main');
        if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const [studentId, setStudentId] = useState('');
    const [password, setPassword] = useState('');
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // 當同步 Modal 開啟時，向伺服器查詢冷卻狀態
    // Fetch server-side cooldown status when sync modal opens
    useEffect(() => {
        if (showSyncModal) {
            canSync();
        }
    }, [showSyncModal, canSync]);

    const handleSync = async (e) => {
        e.preventDefault();
        setSyncSuccess(false);
        if (!studentId.trim() || !password.trim()) return;

        // 防止重複觸發：按下後立即鎖定 / Prevent duplicate: lock immediately on click
        if (isSyncing) return;
        setIsSyncing(true);

        try {
            // 伺服器端同步冷卻檢查 / Server-side rate limit check
            const syncCheck = await canSync();
            if (!syncCheck.allowed) {
                setIsSyncing(false);
                return;
            }

            const success = await login(studentId.trim(), password);
            if (success) {
                // 序列化執行，避免同一 session 被並行存取的競爭條件
                await fetchTimetable();
                await fetchGrades();
                // 同步任務：先從伺服器下載覆蓋本地，再上傳確保伺服器有最新版
                // Sync tasks: download from server first, then upload to ensure server has latest
                await syncTasksFromServer();
                await syncTasksToServer();
                recordSyncSuccess();
                setSyncSuccess(true);
                setTimeout(() => {
                    setShowSyncModal(false);
                    setPassword('');
                    setSyncSuccess(false);
                    setIsSyncing(false);
                }, 1500);
            } else {
                // 登入失敗計入同步錯誤，並解鎖讓使用者可重試
                // Login failure counts as sync error; unlock so user can retry
                recordSyncError();
                setIsSyncing(false);
            }
        } catch {
            // 未預期的錯誤也解鎖 / Unlock on unexpected errors too
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
        // 注意：不再清除冷卻相關 localStorage，冷卻由伺服器端 IP 追蹤強制執行
        // Note: cooldown localStorage is NOT cleared; enforced server-side via IP tracking
        window.location.reload();
    };

    const themeOptions = [
        { value: 'light', label: '淺色 Light', icon: IconSun },
        { value: 'dark', label: '深色 Dark', icon: IconMoon },
        { value: 'system', label: '系統 System', icon: IconSettings },
    ];

    return (
        <div className="section-stack animate-fade-in">
            {/* ── 標題 / Header ── */}
            <div style={{ paddingBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <IconSettings size={24} style={{ color: 'var(--text-muted)' }} />
                    <h2 style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                        系統設定
                    </h2>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Settings</span>
                </div>
            </div>

            {/* ═══ 帳戶 / Account ═══ */}
            <div className="card-stack">
                <SectionHeader title="個人帳戶" titleEn="Account" />
                <div className="card">
                    {/* 用戶資訊 */}
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
                                {isAuthenticated && user ? user.name : '同學你好'}
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {hasCachedData() ? (
                                    <>
                                        <IconCheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                                        <span>已同步校園資料</span>
                                        {lastSyncTime > 0 && (
                                            <span style={{ fontSize: '12px' }}>
                                                ({new Date(lastSyncTime).toLocaleString('zh-TW')})
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <IconXCircle size={14} />
                                        <span>未同步校園資料</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    {/* 同步 & 登出 */}
                    <div style={{ paddingTop: '4px' }}>
                        <SettingItem
                            icon={IconBook}
                            label="同步校園資料"
                            labelEn="Sync portal data"
                            onClick={() => { clearError(); setShowSyncModal(true); setSyncSuccess(false); scrollToTop(); }}
                        />
                        {(isAuthenticated || localStorage.getItem('piyou_timetable')) && (
                            <SettingItem icon={IconLogOut} label="清除資料與登出" labelEn="Sign out & Clear Data" onClick={handleLogout} />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Sync Data Modal ── */}
            {showSyncModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', background: 'rgba(0,0,0,0.5)',
                }} className="animate-fade-in">
                    <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                            同步校園資料
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            請輸入校務系統帳號密碼，以擈取最新課表與成績至本機端。
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            🔒 帳密不會被儲存，資料僅存於您的裝置。
                        </p>

                        {/* 同步頻率限制提示（伺服器端判定）/ Server-side cooldown notice */}
                        {serverCooldown && !serverCooldown.allowed && (() => {
                            const mins = Math.ceil((serverCooldown.remainingMs || 0) / 60000);
                            return (
                                <div style={{
                                    padding: '12px', borderRadius: '10px', marginBottom: '12px',
                                    background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)', fontSize: '14px',
                                }}>
                                    {serverCooldown.reason === 'locked'
                                        ? `🔒 同步錯誤過多，已暫時鎖定，請 ${mins} 分鐘後重試`
                                        : `⏳ 同步冷卻中，距離下次可同步還有 ${mins} 分鐘`}
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
                                同步成功！/ Sync successful!
                            </div>
                        )}

                        <form onSubmit={handleSync}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input
                                    type="text"
                                    placeholder="學號 Student ID"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="input"
                                    style={{ padding: '12px 16px', fontSize: '15px' }}
                                    aria-label="學號"
                                    autoComplete="username"
                                />
                                <input
                                    type="password"
                                    placeholder="密碼 Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input"
                                    style={{ padding: '12px 16px', fontSize: '15px' }}
                                    aria-label="密碼"
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
                                    取消 Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSyncing || !studentId.trim() || !password.trim() || (serverCooldown && !serverCooldown.allowed)}
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '12px', fontSize: '15px', opacity: (isSyncing || !studentId.trim() || !password.trim() || (serverCooldown && !serverCooldown.allowed)) ? 0.5 : 1 }}
                                >
                                    {isSyncing ? '同步中...' : (serverCooldown && !serverCooldown.allowed) ? '暫不可用' : '同步 Sync'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Logout Confirmation Modal ── */}
            {showLogoutConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', background: 'rgba(0,0,0,0.5)',
                }} className="animate-fade-in">
                    <div className="card" style={{ width: '100%', maxWidth: '380px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                            確認登出
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
                            此操作將清除所有已同步的校園資料（課表、成績等）並登出帳號，確定要繼續嗎？
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(false)}
                                className="btn btn-ghost"
                                style={{ flex: 1, padding: '12px', fontSize: '15px' }}
                            >
                                取消
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
                                確認登出
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ 外觀 / Appearance ═══ */}
            <div className="card-stack">
                <SectionHeader title="外觀" titleEn="Appearance" />
                <div className="card">
                    <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: 500, paddingBottom: '14px', padding: '4px 8px 14px' }}>
                        主題模式 / Theme Mode
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {themeOptions.map((opt) => {
                            const isActive = theme === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => setTheme(opt.value)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                                        padding: '14px 16px', borderRadius: '12px', fontSize: '15px', fontWeight: 500,
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        background: isActive ? 'var(--color-brand-subtle)' : 'var(--bg-input)',
                                        color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
                                        border: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
                                    }}
                                >
                                    <opt.icon size={22} />
                                    <span>{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── 色彩主題 / Color Theme ── */}
                <div className="card">
                    <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: 500, padding: '4px 8px 14px' }}>
                        色彩主題 / Color Theme
                    </p>
                    <div className="theme-picker">
                        {COLOR_THEMES.map((t) => (
                            <button
                                key={t.id}
                                className={`theme-swatch ${colorTheme === t.id ? 'active' : ''}`}
                                onClick={() => setColorTheme(t.id)}
                                aria-label={`${t.label} ${t.labelEn}`}
                            >
                                <div
                                    className="theme-swatch-dot"
                                    style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)` }}
                                />
                                <div>
                                    <div className="theme-swatch-label">{t.label}</div>
                                    <div className="theme-swatch-sublabel">{t.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ 通知 / Notifications ═══ */}
            <div className="card-stack">
                <SectionHeader title="通知" titleEn="Notifications" />
                <div className="card">
                    <SettingItem icon={IconBell} label="公車到站提醒" labelEn="Bus arrival alerts">
                        <Toggle checked={busNotify} onChange={setBusNotify} aria-label="公車到站提醒" />
                    </SettingItem>
                    <SettingItem icon={IconBell} label="任務截止提醒" labelEn="Task deadline reminders">
                        <Toggle checked={taskNotify} onChange={setTaskNotify} aria-label="任務截止提醒" />
                    </SettingItem>
                </div>
            </div>

            {/* ═══ 關於 / About ═══ */}
            <div className="card-stack">
                <SectionHeader title="關於" titleEn="About" />
                <div className="card">
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 8px',
                    }}>
                        <span style={{ color: 'var(--text)', fontSize: '15px', fontWeight: 500 }}>版本 / Version</span>
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
