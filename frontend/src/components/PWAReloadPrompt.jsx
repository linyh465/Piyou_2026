/**
 * PWA 更新提示元件 / PWA Update Prompt Component
 * 當 Service Worker 偵測到新版本時顯示更新提示
 * Shows update prompt when Service Worker detects a new version.
 */
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PWAReloadPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            // 每 30 分鐘檢查一次更新 / Check for updates every 30 min
            if (r) {
                setInterval(() => {
                    r.update();
                }, 30 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.warn('SW registration error:', error);
        },
    });

    useEffect(() => {
        setShowPrompt(needRefresh);
    }, [needRefresh]);

    if (!showPrompt) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                background: 'var(--bg-card, #1a1a2e)',
                border: '1px solid var(--border, #333)',
                borderRadius: '16px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                fontSize: '13px',
                color: 'var(--text, #eee)',
                maxWidth: 'calc(100vw - 32px)',
                animation: 'slideUp 0.3s ease-out',
            }}
        >
            <span>🔄 有新版本可用</span>
            <button
                onClick={() => updateServiceWorker(true)}
                style={{
                    background: 'var(--color-brand, #6366f1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                }}
            >
                立即更新
            </button>
            <button
                onClick={() => { setNeedRefresh(false); setShowPrompt(false); }}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #888)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '0 4px',
                    lineHeight: 1,
                }}
                aria-label="關閉"
            >
                ✕
            </button>
        </div>
    );
}
