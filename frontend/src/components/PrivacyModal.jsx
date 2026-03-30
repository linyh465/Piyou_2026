/**
 * 隱私權與資安免責聲明彈窗 / Privacy & Security Disclaimer Modal
 * 每台裝置首次使用時顯示一次（localStorage 記錄）。
 * Shown once per device on first use (stored in localStorage).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';

const PRIVACY_ACCEPTED_KEY = 'piyou_privacy_accepted';

const SECTION = ({ icon, title, children }) => (
    <div>
        <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>{icon} {title}</p>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '13.5px' }}>{children}</div>
    </div>
);

export default function PrivacyModal() {
    const [visible] = useState(() => !localStorage.getItem(PRIVACY_ACCEPTED_KEY));

    if (!visible) return null;

    const handleAccept = () => {
        localStorage.setItem(PRIVACY_ACCEPTED_KEY, '1');
        document.getElementById('piyou-privacy-modal')?.remove();
    };

    return createPortal(
        <div
            id="piyou-privacy-modal"
            style={{
                position: 'fixed', inset: 0, zIndex: 300,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                background: 'rgba(0,0,0,0.65)',
            }}
            className="animate-fade-in"
        >
            <div style={{
                width: '100%', maxWidth: '560px',
                borderRadius: '24px 24px 0 0',
                background: 'var(--bg-card)',
                boxShadow: '0 -4px 40px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                maxHeight: '90vh',
            }}>
                {/* 把手 */}
                <div style={{ width: '36px', height: '5px', borderRadius: '3px', background: 'var(--text-muted)', opacity: 0.3, margin: '12px auto 0', flexShrink: 0 }} />

                {/* 標題 */}
                <div style={{ padding: '14px 24px 8px', flexShrink: 0 }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                        隱私權、資訊安全與免責聲明
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
                        使用前請詳閱以下說明 · 每台裝置只顯示一次
                    </p>
                </div>

                {/* 內容（可捲動）*/}
                <div style={{ padding: '4px 24px 12px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        <SECTION icon="🔐" title="帳號密碼安全">
                            <p>您的 E校園服務網帳號與密碼<strong>僅在您主動點擊「同步」時</strong>，透過 HTTPS 加密連線傳送至伺服器進行一次性驗證，驗證完成後<strong>立即丟棄，不儲存於伺服器或本機裝置</strong></p>
                        </SECTION>

                        <SECTION icon="🔄" title="同步功能說明">
                            <p>「同步校園資料」為<strong>自願選擇的功能</strong>，需由您主動前往「設定 → 同步校園資料」操作。同步取回的課表、成績等資料<strong>僅存放於您的裝置本機</strong>（localStorage / IndexedDB），不上傳至任何第三方雲端。登出時可一鍵清除所有本機資料。</p>
                        </SECTION>

                        <SECTION icon="📊" title="匿名使用行為分析">
                            <p>本應用程式會收集<strong>匿名化使用事件</strong>（頁面瀏覽次數、功能使用次數、同步成功/失敗），用於改善服務品質。所有記錄僅使用<strong>裝置 ID 雜湊值</strong>（SHA-256 前 16 碼），無法反推出您的身份。不收集姓名、學號、聯絡方式或任何個人識別資訊。</p>
                        </SECTION>

                        <SECTION icon="🌐" title="第三方服務揭露">
                            <p>本應用程式使用以下第三方服務：</p>
                            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                                <li><strong>雲端資料服務</strong> — 儲存公告、意見回饋、共享平台內容及使用分析事件</li>
                                <li><strong>後端託管平台</strong> — 本應用程式後端服務的雲端部署環境</li>
                                <li><strong>TDX 運輸資料流通服務</strong> — 公車即時到站資訊</li>
                            </ul>
                            <p style={{ marginTop: '6px' }}>上述服務均有各自的隱私政策，請自行參閱。本應用程式不對第三方資料處理方式負責。</p>
                        </SECTION>

                        <SECTION icon="🔗" title="共享平台資安提醒">
                            <p>共享平台的連結與內容由使用者自行發布。<strong>點擊他人分享的連結前，請確認來源可信，切勿輸入帳號密碼或個人資料。</strong>本應用程式不對第三方連結的安全性負責，分享內容違規責任由發布者自行承擔。</p>
                        </SECTION>

                        <SECTION icon="⚠️" title="免責聲明">
                            <p>本應用程式為<strong>非官方學生自製工具</strong>，與靜宜大學無任何直接關係。資料準確性以學校官方系統（E校園服務網）為準，本應用程式不保證資料完整性或即時性。使用本應用程式所產生的任何問題，開發者不負法律責任。服務可能在未事先通知的情況下變更或終止。</p>
                        </SECTION>

                        <SECTION icon="🗑️" title="資料刪除權">
                            <p>您可隨時在「設定 → 登出」清除所有本機校園資料。若要刪除曾提交的意見回饋或共享平台內容，請透過意見回饋功能聯繫管理員。</p>
                        </SECTION>

                    </div>
                </div>

                {/* 按鈕 */}
                <div style={{ padding: '12px 24px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', flexShrink: 0, borderTop: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 10px' }}>
                        點擊下方按鈕即表示您已閱讀並同意上述聲明。完整版隱私權政策與服務條款請見「設定 → 關於」。
                    </p>
                    <button
                        onClick={handleAccept}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                            background: 'var(--color-brand)', color: 'white',
                            fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        我已閱讀，同意繼續使用
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
