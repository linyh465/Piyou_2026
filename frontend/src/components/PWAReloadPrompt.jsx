/**
 * PWA 更新提示元件 / PWA Update Prompt Component
 * 當 Service Worker 偵測到新版本（GitHub 推送後部署）時，
 * 顯示倒數彈窗並自動執行重整更新。
 */
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { setSwRegistration, setUpdateServiceWorker } from '../services/pwaUpdate';

const AUTO_UPDATE_SECONDS = 10;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 每 5 分鐘檢查一次

export default function PWAReloadPrompt() {
    const { t } = useTranslation('common');
    const [countdown, setCountdown] = useState(AUTO_UPDATE_SECONDS);
    const countdownRef = useRef(null);

    const swIntervalRef = useRef(null);

    // Cleanup SW update interval on unmount
    useEffect(() => () => { if (swIntervalRef.current) clearInterval(swIntervalRef.current); }, []);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            if (r) {
                setSwRegistration(r);
                swIntervalRef.current = setInterval(() => r.update(), CHECK_INTERVAL_MS);
            }
        },
        onRegisterError(error) {
            console.warn('SW registration error:', error);
        },
    });

    // 將 updateServiceWorker 函式存入單例，供手動更新按鈕使用
    // Store updateServiceWorker in singleton for manual update button
    useEffect(() => {
        setUpdateServiceWorker(updateServiceWorker);
    }, [updateServiceWorker]);

    // 偵測到新版本時開始倒數，歸零自動更新
    useEffect(() => {
        if (!needRefresh) return;

        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current);
                    updateServiceWorker(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(countdownRef.current);
    }, [needRefresh, updateServiceWorker]);

    const handleUpdateNow = () => {
        clearInterval(countdownRef.current);
        updateServiceWorker(true);
    };

    const handleDismiss = () => {
        clearInterval(countdownRef.current);
        setNeedRefresh(false);
    };

    if (!needRefresh) return null;

    return (
        <>
            {/* 背景遮罩 */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    zIndex: 9998,
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    animation: 'pwaFadeIn 0.25s ease-out',
                }}
            />

            {/* 彈窗主體 */}
            <div
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 9999,
                    width: 'min(360px, calc(100vw - 40px))',
                    background: 'var(--bg-card, #1a1a2e)',
                    border: '1px solid var(--border, #333)',
                    borderRadius: '20px',
                    padding: '28px 24px 24px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    color: 'var(--text, #eee)',
                    animation: 'pwaSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            >
                {/* 圖示 */}
                <div
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 26,
                        marginBottom: 4,
                        boxShadow: '0 0 24px rgba(99,102,241,0.4)',
                    }}
                >
                    🚀
                </div>

                {/* 標題 */}
                <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'center' }}>
                    {t('pwaNewVersion')}
                </div>

                {/* 說明 */}
                <div
                    style={{
                        fontSize: 13,
                        color: 'var(--text-muted, #aaa)',
                        textAlign: 'center',
                        lineHeight: 1.6,
                    }}
                >
                    {t('pwaAutoRefresh', { countdown })}
                </div>

                {/* 倒數進度條 */}
                <div
                    style={{
                        width: '100%',
                        height: 4,
                        background: 'var(--border, #333)',
                        borderRadius: 4,
                        overflow: 'hidden',
                        margin: '4px 0',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${(countdown / AUTO_UPDATE_SECONDS) * 100}%`,
                            background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
                            borderRadius: 4,
                            transition: 'width 1s linear',
                        }}
                    />
                </div>

                {/* 按鈕群 */}
                <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
                    <button
                        onClick={handleDismiss}
                        style={{
                            flex: 1,
                            padding: '9px 0',
                            background: 'var(--bg, #12121f)',
                            border: '1px solid var(--border, #444)',
                            borderRadius: 12,
                            color: 'var(--text-muted, #aaa)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        {t('pwaLater')}
                    </button>
                    <button
                        onClick={handleUpdateNow}
                        style={{
                            flex: 2,
                            padding: '9px 0',
                            background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                            border: 'none',
                            borderRadius: 12,
                            color: 'white',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                        }}
                    >
                        {t('pwaUpdateNow')}
                    </button>
                </div>
            </div>

            {/* 動畫樣式 */}
            <style>{`
                @keyframes pwaFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes pwaSlideUp {
                    from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)); }
                    to   { opacity: 1; transform: translate(-50%, -50%); }
                }
            `}</style>
        </>
    );
}
