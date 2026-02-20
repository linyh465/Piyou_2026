/**
 * 設定頁面 / Settings Page
 * 帳戶管理、外觀主題切換、通知偏好
 * Account management, appearance theme toggle, notification prefs.
 *
 * 排版間距與字體大小統一與首頁 Dashboard 一致
 * Layout spacing and font sizes unified with Dashboard.
 */
import { useState } from 'react';
import useThemeStore from '../stores/themeStore';
import useAuthStore from '../stores/authStore';
import useTimetableStore from '../stores/timetableStore';
import {
    IconUser, IconSun, IconMoon, IconBell, IconSettings,
    IconLogOut, IconChevronRight, IconBook
} from '../components/Icons';

// ── 設定項目元件 / Setting Item Component ──
function SettingItem({ icon: Icon, label, labelEn, children, onClick }) {
    return (
        <div
            onClick={onClick}
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
function Toggle({ checked, onChange }) {
    return (
        <button
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
    const { theme, setTheme } = useThemeStore();
    const { user, isAuthenticated, login, logout, isLoading, error, clearError } = useAuthStore();
    const { fetchTimetable, fetchGrades } = useTimetableStore();

    const [busNotify, setBusNotify] = useState(true);
    const [taskNotify, setTaskNotify] = useState(true);

    const [showSyncModal, setShowSyncModal] = useState(false);
    const [studentId, setStudentId] = useState('');
    const [password, setPassword] = useState('');
    const [syncSuccess, setSyncSuccess] = useState(false);

    const handleSync = async (e) => {
        e.preventDefault();
        setSyncSuccess(false);
        if (!studentId.trim() || !password.trim()) return;

        const success = await login(studentId.trim(), password);
        if (success) {
            await Promise.all([fetchTimetable(), fetchGrades()]);
            setSyncSuccess(true);
            setTimeout(() => {
                setShowSyncModal(false);
                setPassword('');
                setSyncSuccess(false);
            }, 1500);
        }
    };

    const handleLogout = () => {
        logout();
        localStorage.removeItem('piyou_timetable');
        localStorage.removeItem('piyou_grades');
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
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                                {isAuthenticated && user ? `${user.student_id} (已同步資料)` : '未同步資料 / Not synced'}
                            </p>
                        </div>
                    </div>
                    {/* 同步 & 登出 */}
                    <div style={{ paddingTop: '4px' }}>
                        <SettingItem
                            icon={IconBook}
                            label="同步校務資料"
                            labelEn="Sync portal data"
                            onClick={() => { clearError(); setShowSyncModal(true); setSyncSuccess(false); }}
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
                            同步校務資料
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            請輸入校務系統帳號密碼，以撈取最新課表與成績至本機端。
                        </p>

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
                                />
                                <input
                                    type="password"
                                    placeholder="密碼 Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input"
                                    style={{ padding: '12px 16px', fontSize: '15px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowSyncModal(false)}
                                    disabled={isLoading}
                                    className="btn btn-ghost"
                                    style={{ flex: 1, padding: '12px', fontSize: '15px' }}
                                >
                                    取消 Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading || !studentId.trim() || !password.trim()}
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '12px', fontSize: '15px', opacity: (!studentId.trim() || !password.trim()) ? 0.5 : 1 }}
                                >
                                    {isLoading ? '同步中...' : '同步 Sync'}
                                </button>
                            </div>
                        </form>
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
            </div>

            {/* ═══ 通知 / Notifications ═══ */}
            <div className="card-stack">
                <SectionHeader title="通知" titleEn="Notifications" />
                <div className="card">
                    <SettingItem icon={IconBell} label="公車到站提醒" labelEn="Bus arrival alerts">
                        <Toggle checked={busNotify} onChange={setBusNotify} />
                    </SettingItem>
                    <SettingItem icon={IconBell} label="任務截止提醒" labelEn="Task deadline reminders">
                        <Toggle checked={taskNotify} onChange={setTaskNotify} />
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
