/**
 * 設定頁面 / Settings Page
 * 帳戶管理、外觀主題切換、通知偏好、客製化選項
 * Account management, appearance theme toggle, notification prefs, and customization.
 */
import { useState } from 'react';
import useThemeStore from '../stores/themeStore';
import {
    IconUser, IconSun, IconMoon, IconBell, IconSettings,
    IconLogOut, IconChevronRight,
} from '../components/Icons';

// ── 設定項目元件 / Setting Item Component ──
function SettingItem({ icon: Icon, label, labelEn, children, onClick }) {
    return (
        <div
            className={`flex items-center justify-between py-3 px-1 ${onClick ? 'cursor-pointer' : ''}`}
            style={{ borderBottom: '1px solid var(--border-light)' }}
            onClick={onClick}
        >
            <div className="flex items-center gap-3">
                {Icon && <Icon size={18} style={{ color: 'var(--text-muted)' }} />}
                <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</p>
                    {labelEn && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{labelEn}</p>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {children}
                {onClick && <IconChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
            </div>
        </div>
    );
}

// ── 開關元件 / Toggle Switch ──
function Toggle({ checked, onChange }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: checked ? 'var(--color-brand)' : 'var(--border)' }}
        >
            <span
                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200"
                style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
            />
        </button>
    );
}

// ── 段落標題 / Section Header ──
function SectionHeader({ title, titleEn }) {
    return (
        <div className="pt-5 pb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {title} / {titleEn}
            </h3>
        </div>
    );
}

export default function Settings() {
    const { theme, setTheme, resolvedTheme } = useThemeStore();
    const [busNotify, setBusNotify] = useState(true);
    const [taskNotify, setTaskNotify] = useState(true);
    const [accentColor, setAccentColor] = useState('indigo');

    const themeOptions = [
        { value: 'light', label: '淺色 Light', icon: IconSun },
        { value: 'dark', label: '深色 Dark', icon: IconMoon },
        { value: 'system', label: '系統 System', icon: IconSettings },
    ];

    const accentColors = [
        { value: 'indigo', color: '#6366f1', label: 'Indigo' },
        { value: 'teal', color: '#14b8a6', label: 'Teal' },
        { value: 'rose', color: '#f43f5e', label: 'Rose' },
        { value: 'amber', color: '#f59e0b', label: 'Amber' },
    ];

    return (
        <div className="space-y-1 max-w-lg mx-auto animate-fade-in">
            {/* 標題 / Header */}
            <div className="flex items-center gap-3 pb-2">
                <IconSettings size={24} style={{ color: 'var(--text-muted)' }} />
                <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>設定</h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Settings</p>
                </div>
            </div>

            {/* ═══ 帳戶 / Account ═══ */}
            <SectionHeader title="帳戶" titleEn="Account" />
            <div className="card p-4">
                <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-brand)', color: 'white' }}
                    >
                        <IconUser size={24} />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>同學你好</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>學號未登入 / Not logged in</p>
                    </div>
                </div>
                <SettingItem icon={IconLogOut} label="登出" labelEn="Sign out" onClick={() => { }} />
            </div>

            {/* ═══ 外觀 / Appearance ═══ */}
            <SectionHeader title="外觀" titleEn="Appearance" />
            <div className="card p-4">
                <p className="text-sm font-medium pb-2" style={{ color: 'var(--text)' }}>
                    主題模式 / Theme Mode
                </p>
                <div className="flex gap-2">
                    {themeOptions.map((opt) => {
                        const isActive = theme === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setTheme(opt.value)}
                                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-all duration-200"
                                style={{
                                    background: isActive ? 'var(--color-brand-subtle)' : 'var(--bg-input)',
                                    color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
                                    border: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
                                }}
                            >
                                <opt.icon size={20} />
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══ 主色系 / Accent Color ═══ */}
            <div className="card p-4 mt-2">
                <p className="text-sm font-medium pb-3" style={{ color: 'var(--text)' }}>
                    主色系 / Accent Color
                </p>
                <div className="flex gap-3">
                    {accentColors.map((c) => (
                        <button
                            key={c.value}
                            onClick={() => setAccentColor(c.value)}
                            className="flex flex-col items-center gap-1.5"
                        >
                            <div
                                className="w-8 h-8 rounded-full transition-transform"
                                style={{
                                    background: c.color,
                                    transform: accentColor === c.value ? 'scale(1.2)' : 'scale(1)',
                                    boxShadow: accentColor === c.value ? `0 0 0 3px var(--bg), 0 0 0 5px ${c.color}` : 'none',
                                }}
                            />
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ 通知 / Notifications ═══ */}
            <SectionHeader title="通知" titleEn="Notifications" />
            <div className="card p-4">
                <SettingItem icon={IconBell} label="公車到站提醒" labelEn="Bus arrival alerts">
                    <Toggle checked={busNotify} onChange={setBusNotify} />
                </SettingItem>
                <SettingItem icon={IconBell} label="任務截止提醒" labelEn="Task deadline reminders">
                    <Toggle checked={taskNotify} onChange={setTaskNotify} />
                </SettingItem>
            </div>

            {/* ═══ 關於 / About ═══ */}
            <SectionHeader title="關於" titleEn="About" />
            <div className="card p-4">
                <div className="flex items-center justify-between py-1">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>版本 / Version</span>
                    <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>1.0.0-beta</span>
                </div>
            </div>
        </div>
    );
}
