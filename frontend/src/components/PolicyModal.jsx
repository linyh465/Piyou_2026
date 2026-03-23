/**
 * 隱私權政策 / 服務條款 全文 Modal
 * Privacy Policy / Terms of Service full-text modal.
 * 在設定 → 關於 區塊中開啟。
 */
import { createPortal } from 'react-dom';
import { IconXCircle } from './Icons';

const H2 = ({ children }) => (
    <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '20px 0 6px', borderLeft: '3px solid var(--color-brand)', paddingLeft: '10px' }}>
        {children}
    </h2>
);

const P = ({ children }) => (
    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 8px' }}>
        {children}
    </p>
);

const LI = ({ children }) => (
    <li style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '4px' }}>
        {children}
    </li>
);

// ── 隱私權政策內容 / Privacy Policy content ──
function PrivacyContent() {
    return (
        <>
            <P>最後更新日期：2026年3月 · 本政策適用於「披呦 Piyou」應用程式（以下簡稱「本應用程式」）。</P>

            <H2>一、資料控管者</H2>
            <P>本應用程式由靜宜大學學生個人開發，非官方機構，亦與靜宜大學無直接關係。如有任何隱私相關問題，請透過應用程式內的「意見回饋」功能聯繫。</P>

            <H2>二、收集的資料</H2>
            <P>本應用程式<strong>不收集任何可直接識別個人身份的資料</strong>（如姓名、學號、電子郵件）。具體收集範圍如下：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI><strong>匿名裝置識別碼：</strong>隨機產生的 UUID，於本機產生並雜湊（SHA-256）後用於匿名分析統計，無法反推身份。</LI>
                <LI><strong>使用行為事件：</strong>頁面瀏覽次數、功能使用次數、同步成功/失敗次數，均以匿名形式記錄，不含任何個人內容。</LI>
                <LI><strong>意見回饋：</strong>您主動提交的文字回饋，以及您選填的聯絡方式（非強制）。</LI>
                <LI><strong>共享平台內容：</strong>您主動建立的分享標題、內文與連結，以雜湊裝置 ID 標記擁有者。</LI>
            </ul>

            <H2>三、帳號密碼處理（零儲存政策）</H2>
            <P>您的 E校園服務網帳號密碼<strong>僅用於一次性驗證</strong>，透過 HTTPS 加密傳輸至伺服器。驗證完成後<strong>立即丟棄</strong>，不寫入任何資料庫、日誌或快取。伺服器程式碼設有日誌過濾機制，確保敏感字串不會出現在任何記錄中。</P>

            <H2>四、校園資料本地儲存</H2>
            <P>課表、成績、圖書館借閱紀錄等資料<strong>僅存放於您的裝置本機</strong>（Web Storage / IndexedDB），不上傳至本應用程式的伺服器或任何第三方雲端服務。您可隨時透過「設定 → 登出」清除所有本機資料。</P>

            <H2>五、第三方服務</H2>
            <P>本應用程式使用以下第三方服務，各服務均有其獨立的隱私政策：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI><strong>Google Sheets（Google LLC）</strong>：儲存公告、意見回饋、共享平台貼文及匿名使用分析事件。</LI>
                <LI><strong>Railway（Railway Corp.）</strong>：後端 API 服務的雲端託管平台。</LI>
                <LI><strong>TDX 運輸資料流通服務（交通部）</strong>：提供公車即時到站資訊。</LI>
            </ul>
            <P>本應用程式不對上述第三方的資料處理方式負責，請自行參閱各服務的隱私政策。</P>

            <H2>六、Cookie 與本地儲存</H2>
            <P>本應用程式<strong>不使用任何第三方追蹤 Cookie</strong>。僅使用瀏覽器的 localStorage / sessionStorage 儲存應用程式設定（主題、已讀公告等）及校園資料。所有資料保存於您的裝置本機，可隨時清除。</P>

            <H2>七、資料安全措施</H2>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>所有 API 通訊均透過 HTTPS 加密傳輸</LI>
                <LI>管理員帳號使用 bcrypt 雜湊儲存密碼</LI>
                <LI>JWT 身份驗證採用強隨機金鑰（伺服器端）</LI>
                <LI>登入端點設有速率限制（每分鐘最多 10 次）</LI>
                <LI>裝置識別碼於後端統一雜湊，原始 ID 不離開裝置</LI>
                <LI>伺服器設有憑證日誌過濾機制（零日誌政策）</LI>
                <LI>HTTP 安全標頭：CSP、X-Frame-Options、X-Content-Type-Options</LI>
            </ul>

            <H2>八、資料保留與刪除</H2>
            <P>本機資料：可隨時於「設定 → 登出」清除。意見回饋與共享平台內容：由管理員在 Google Sheets 中管理，如需刪除請透過意見回饋聯繫。匿名分析事件：不含個人資訊，不提供個別刪除。</P>

            <H2>九、未成年人</H2>
            <P>本應用程式以大學在校學生為主要使用族群。本應用程式不主動收集未成年人的個人資料。</P>

            <H2>十、政策變更</H2>
            <P>本隱私權政策可能因應法規或功能調整而修訂，修訂後將於應用程式內公告。繼續使用即視為同意最新版本的政策。</P>
        </>
    );
}

// ── 服務條款內容 / Terms of Service content ──
function TermsContent() {
    return (
        <>
            <P>最後更新日期：2026年3月 · 使用「披呦 Piyou」即表示您同意以下服務條款。</P>

            <H2>一、服務性質</H2>
            <P>本應用程式為<strong>非官方學生自製工具</strong>，與靜宜大學及其附屬單位無任何直接關係，亦未獲得學校官方授權。本應用程式整合 E校園服務網等校方系統資訊，資料準確性以學校官方系統為準。</P>

            <H2>二、使用資格</H2>
            <P>本應用程式主要供靜宜大學在校學生使用，其他人員亦可使用非需登入的公開功能（如公車資訊、共享平台查詢）。使用本應用程式即代表您具備完整的民事行為能力，或已取得法定代理人同意。</P>

            <H2>三、禁止行為</H2>
            <P>使用本應用程式時，您不得：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>將本應用程式用於任何商業目的或向他人收取費用</LI>
                <LI>使用自動化工具（爬蟲、機器人）對本應用程式進行大量請求或攻擊</LI>
                <LI>嘗試繞過速率限制、身份驗證或其他安全機制</LI>
                <LI>在共享平台上發布違法、詐騙、惡意、色情或侵權內容</LI>
                <LI>利用共享平台的連結功能散布惡意程式或進行網路釣魚</LI>
                <LI>干擾或損害本應用程式的正常運作</LI>
            </ul>

            <H2>四、帳號安全責任</H2>
            <P>您有責任妥善保管 E校園服務網的帳號密碼，不得與他人共用或洩漏。若您的帳號因使用本應用程式而遭受未授權存取，開發者不負連帶責任。如發現帳號異常，請立即聯繫學校資訊中心並更換密碼。</P>

            <H2>五、共享平台規範</H2>
            <P>使用共享平台時，您同意：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>您發布的所有內容由您本人負完全責任</LI>
                <LI>不得發布任何違反中華民國法律、侵害他人智慧財產或違反學校規定的內容</LI>
                <LI>管理員有權在未事先通知的情況下刪除違規內容</LI>
                <LI>共享內容中的連結安全性由發布者負責，點擊者應自行判斷風險</LI>
            </ul>

            <H2>六、服務可用性與免責聲明</H2>
            <P>本應用程式以「現狀」提供，開發者不保證：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>服務不中斷、無錯誤或持續可用</LI>
                <LI>資料完整性、即時性或準確性</LI>
                <LI>服務不因學校系統變更而受影響</LI>
            </ul>
            <P>因使用本應用程式造成的任何直接或間接損失，開發者不負法律責任。</P>

            <H2>七、服務變更與終止</H2>
            <P>開發者保留在未事先通知的情況下，隨時修改、暫停或終止本應用程式全部或部分功能的權利。本應用程式為個人課餘維護，不保證長期持續運營。</P>

            <H2>八、準據法</H2>
            <P>本服務條款依照中華民國法律解釋與適用。如發生爭議，以臺灣臺中地方法院為第一審管轄法院。</P>

            <H2>九、聯繫我們</H2>
            <P>如對本條款有任何疑問，請透過應用程式內的「設定 → 意見回饋」功能聯繫。</P>
        </>
    );
}

// ── 主元件 / Main component ──
export default function PolicyModal({ type, onClose }) {
    // type: 'privacy' | 'terms'
    const isPrivacy = type === 'privacy';
    const title = isPrivacy ? '隱私權政策' : '服務條款';

    return createPortal(
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 250,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
            }}
            className="animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: '100%', maxWidth: '600px',
                borderRadius: '24px 24px 0 0',
                background: 'var(--bg-card)',
                boxShadow: '0 -4px 40px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column',
                maxHeight: '88vh',
            }}>
                {/* 標題欄 */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
                }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                        {title}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        <IconXCircle size={22} />
                    </button>
                </div>

                {/* 內容（可捲動）*/}
                <div style={{ padding: '8px 20px 24px', overflowY: 'auto', flex: 1 }}>
                    {isPrivacy ? <PrivacyContent /> : <TermsContent />}
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '24px', textAlign: 'center' }}>
                        披呦 Piyou · 靜宜大學學生自製 · 非官方工具
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
}
