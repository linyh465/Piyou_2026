/**
 * 隱私權與資安免責聲明彈窗 / Privacy & Security Disclaimer Modal
 * 每台裝置首次使用時顯示一次（localStorage 記錄）。
 * Shown once per device on first use (stored in localStorage).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';

const PRIVACY_ACCEPTED_KEY = 'piyou_privacy_accepted';

export default function PrivacyModal() {
    const [visible] = useState(() => !localStorage.getItem(PRIVACY_ACCEPTED_KEY));

    if (!visible) return null;

    const handleAccept = () => {
        localStorage.setItem(PRIVACY_ACCEPTED_KEY, '1');
        // 強制重新渲染（隱藏 Modal）
        window.dispatchEvent(new Event('piyou_privacy_accepted'));
        // 使用 DOM 直接隱藏，避免需要 state 更新觸發重渲染
        document.getElementById('piyou-privacy-modal')?.remove();
    };

    return createPortal(
        <div
            id="piyou-privacy-modal"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 300,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.6)',
                padding: '0',
            }}
            className="animate-fade-in"
        >
            <div style={{
                width: '100%',
                maxWidth: '560px',
                borderRadius: '24px 24px 0 0',
                background: 'var(--bg-card)',
                boxShadow: '0 -4px 40px rgba(0,0,0,0.2)',
                overflow: 'hidden',
            }}>
                {/* 把手 / Handle */}
                <div style={{ width: '36px', height: '5px', borderRadius: '3px', background: 'var(--text-muted)', opacity: 0.3, margin: '12px auto 0' }} />

                {/* 標題 / Title */}
                <div style={{ padding: '16px 24px 8px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
                        隱私權聲明與資訊安全說明
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        使用前請詳閱以下說明（每台裝置只顯示一次）
                    </p>
                </div>

                {/* 內容 / Content */}
                <div style={{ padding: '0 24px 8px', maxHeight: '45vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        <div>
                            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>🔐 帳號密碼安全</p>
                            <p>本應用程式僅在您主動同步時，將 E校園服務網帳號密碼透過加密連線傳送至伺服器進行驗證。帳號密碼不會被儲存於伺服器或本機裝置，驗證完成後即丟棄。</p>
                        </div>
                        <div>
                            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>📱 本機資料儲存</p>
                            <p>課表、成績、圖書館借閱等校園資料，僅存放於您的裝置本機（IndexedDB / localStorage），不上傳至任何第三方雲端。</p>
                        </div>
                        <div>
                            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>⚠️ 免責聲明</p>
                            <p>本應用程式為非官方學生自製工具，與靜宜大學無直接關係。資料來源為 E校園服務網，資料準確性以學校官方系統為準。使用本應用程式所產生的任何問題，開發者不負法律責任。</p>
                        </div>
                        <div>
                            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>🍪 Cookie 與分析</p>
                            <p>本應用程式不使用任何第三方追蹤 Cookie，亦未整合任何行為分析服務。</p>
                        </div>
                    </div>
                </div>

                {/* 按鈕 / Buttons */}
                <div style={{ padding: '16px 24px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
                    <button
                        onClick={handleAccept}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '14px',
                            border: 'none',
                            background: 'var(--color-brand)',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    >
                        我已閱讀，同意繼續使用
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
