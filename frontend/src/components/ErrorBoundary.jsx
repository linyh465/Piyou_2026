/**
 * React Error Boundary — 攔截子元件的渲染異常，避免整頁白屏。
 * Catches render errors in child components to prevent blank screens.
 */
import { Component } from 'react';

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
