/**
 * React Error Boundary — 攔截子元件的渲染異常，避免整頁白屏。
 * Catches render errors in child components to prevent blank screens.
 * 自動將錯誤回報至後端並寄送 Email 給開發者。
 * Automatically reports errors to the backend which emails the developer.
 */
import { Component } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

function sendErrorReport(error, componentStack) {
    try {
        fetch(`${API_BASE}/report-error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: error?.message || String(error),
                stack: error?.stack || null,
                component_stack: componentStack || null,
                url: window.location.href,
                user_agent: navigator.userAgent,
            }),
        }).catch(() => { /* 靜默失敗 / silent fail */ });
    } catch (_) { /* 靜默失敗 / silent fail */ }
}

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info.componentStack);
        sendErrorReport(error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.hash = '#/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100vh', padding: '24px',
                    textAlign: 'center', fontFamily: 'system-ui, sans-serif',
                }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>
                        發生了非預期的錯誤 😵
                    </h2>
                    <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '24px' }}>
                        {this.state.error?.message || '未知錯誤'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        style={{
                            padding: '10px 24px', borderRadius: '8px', border: 'none',
                            background: 'var(--color-brand, #6366f1)', color: '#fff',
                            fontSize: '0.875rem', cursor: 'pointer',
                        }}
                    >
                        回到首頁
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
