/**
 * 登入頁面 / Login Page
 * 學號 + 密碼登入校務系統
 * Student ID + password login to school portal.
 */
import { useState } from 'react';
import useAuthStore from '../stores/authStore';

export default function Login() {
    const { login, isLoading, error, clearError } = useAuthStore();
    const [studentId, setStudentId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!studentId.trim() || !password.trim()) return;
        await login(studentId.trim(), password);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)',
            padding: '20px',
        }}>
            <div style={{
                width: '100%', maxWidth: '400px',
                animation: 'fadeIn 0.5s ease',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '22px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))',
                        color: 'white', fontSize: '28px', fontWeight: 800,
                        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
                        marginBottom: '20px',
                    }}>
                        P
                    </div>
                    <h1 style={{
                        fontSize: '1.75rem', fontWeight: 800,
                        color: 'var(--text)', letterSpacing: '-0.03em',
                    }}>
                        披呦 Piyou
                    </h1>
                    <p style={{
                        fontSize: '0.875rem', color: 'var(--text-muted)',
                        marginTop: '8px',
                    }}>
                        靜宜大學校園整合 App
                    </p>
                </div>

                {/* Login Card */}
                <div className="card" style={{ padding: '28px 24px' }}>
                    <form onSubmit={handleSubmit}>
                        {/* Error Banner */}
                        {error && (
                            <div style={{
                                padding: '12px 16px', borderRadius: '12px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: 'var(--color-danger)',
                                fontSize: '13px', marginBottom: '20px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <span>⚠️ {error}</span>
                                <button
                                    type="button"
                                    onClick={clearError}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--color-danger)', fontSize: '16px', padding: '0 4px',
                                    }}
                                >×</button>
                            </div>
                        )}

                        {/* Student ID */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'block', fontSize: '13px', fontWeight: 500,
                                color: 'var(--text-secondary)', marginBottom: '8px',
                            }}>
                                學號 Student ID
                            </label>
                            <input
                                type="text"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                placeholder="例如 B11234567"
                                autoComplete="username"
                                autoFocus
                                style={{
                                    width: '100%', padding: '12px 16px',
                                    borderRadius: '12px', fontSize: '15px',
                                    border: '1.5px solid var(--border)',
                                    background: 'var(--bg-input)', color: 'var(--text)',
                                    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'var(--color-brand)';
                                    e.target.style.boxShadow = '0 0 0 3px var(--ring-brand)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--border)';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block', fontSize: '13px', fontWeight: 500,
                                color: 'var(--text-secondary)', marginBottom: '8px',
                            }}>
                                密碼 Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="校務系統密碼"
                                    autoComplete="current-password"
                                    style={{
                                        width: '100%', padding: '12px 48px 12px 16px',
                                        borderRadius: '12px', fontSize: '15px',
                                        border: '1.5px solid var(--border)',
                                        background: 'var(--bg-input)', color: 'var(--text)',
                                        outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                                        boxSizing: 'border-box',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--color-brand)';
                                        e.target.style.boxShadow = '0 0 0 3px var(--ring-brand)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'var(--border)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--text-muted)', fontSize: '13px', padding: '4px',
                                    }}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading || !studentId.trim() || !password.trim()}
                            style={{
                                width: '100%', padding: '14px',
                                borderRadius: '14px', fontSize: '15px', fontWeight: 600,
                                border: 'none', cursor: isLoading ? 'wait' : 'pointer',
                                background: isLoading
                                    ? 'var(--text-muted)'
                                    : 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))',
                                color: 'white',
                                boxShadow: isLoading ? 'none' : '0 4px 16px rgba(99, 102, 241, 0.3)',
                                transition: 'all 0.2s ease',
                                opacity: (!studentId.trim() || !password.trim()) ? 0.5 : 1,
                            }}
                        >
                            {isLoading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <span className="animate-spin" style={{
                                        width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white', borderRadius: '50%', display: 'inline-block',
                                    }} />
                                    登入中...
                                </span>
                            ) : '登入 Login'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p style={{
                    textAlign: 'center', fontSize: '12px',
                    color: 'var(--text-muted)', marginTop: '24px',
                }}>
                    🔒 帳密直接傳送至校務系統驗證，不會被儲存
                </p>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
