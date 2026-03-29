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
            <P>本應用程式由靜宜大學學生個人開發，為非官方工具，與靜宜大學及其附屬單位無任何直接關係，亦未獲得學校官方授權。如有任何隱私相關問題，請透過應用程式內的「意見回饋」功能聯繫。</P>

            <H2>二、收集的資料</H2>
            <P>本應用程式<strong>不收集任何可直接識別個人身份的資料</strong>（如姓名、學號、電子郵件）。具體收集範圍如下：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI><strong>匿名裝置識別碼：</strong>隨機產生的 UUID，於本機產生並雜湊（SHA-256）後用於匿名分析統計，無法反推身份。</LI>
                <LI><strong>使用行為事件：</strong>頁面瀏覽次數、功能使用次數、同步成功/失敗次數，均以匿名形式記錄，不含任何個人內容。</LI>
                <LI><strong>意見回饋：</strong>您主動提交的文字回饋，以及您選填的聯絡方式（非強制）。</LI>
                <LI><strong>共享平台內容：</strong>您主動建立的分享標題、內文與連結，以雜湊裝置 ID 標記擁有者。</LI>
            </ul>

            <H2>三、E校園帳號密碼處理</H2>
            <P>為提供課表、成績、圖書館等校務資料查詢功能，本應用程式需代理您登入靜宜大學 E 校園服務網。本應用程式採用<strong>零帳密儲存（Zero-Credential-Storage）</strong>設計，帳號密碼用畢即丟棄，<strong>絕不以任何形式快取或持久化存放</strong>。完整處理流程如下：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI><strong>傳輸：</strong>帳號密碼透過 HTTPS 加密傳輸至本應用程式後端伺服器，過程中不以明文傳送。</LI>
                <LI><strong>驗證後立即丟棄：</strong>後端伺服器代理向靜宜大學 E 校園服務網進行身份驗證後，帳號密碼即<strong>立即從記憶體中丟棄</strong>，不以任何形式（明文、編碼、加密）保留於全域變數、快取或任何持久化儲存中。</LI>
                <LI><strong>校園登入 Session 快取：</strong>登入後取得的學校 Session（類似登入 Cookie），存放於伺服器記憶體，保留 <strong>30 分鐘</strong>，期間可直接取用校務資料，無需重新登入學校系統。Session 過期後需重新執行同步以取得新 Session。</LI>
                <LI><strong>永不寫入磁碟：</strong>帳號密碼及 Session <strong>絕不寫入任何資料庫、磁碟檔案、持久化儲存或日誌記錄</strong>。伺服器程式碼設有零日誌政策，確保含帳密字串的記錄被自動攔截。</LI>
                <LI><strong>伺服器重啟即消失：</strong>所有記憶體中的 Session 於伺服器重啟後自動清空，不留任何痕跡。</LI>
            </ul>
            <P>由於本應用程式不快取您的帳號密碼，校園 Session 過期（30 分鐘）後，您需重新執行「同步校園資料」以取得新 Session。這是為了確保您的帳密安全，屬於預期行為。</P>

            <H2>四、同步功能說明與頻率限制</H2>
            <P>「同步校園資料」為<strong>完全自願的選擇性功能</strong>，需由您主動在各頁面或「設定 → 同步校園資料」中操作。為保護本應用程式伺服器及靜宜大學 E 校園系統的穩定性，同步功能設有以下限制：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI><strong>同步冷卻時間：</strong>每次成功同步後，同一裝置須等待 <strong>10 分鐘</strong>方可再次同步。</LI>
                <LI><strong>錯誤鎖定機制：</strong>連續登入失敗 <strong>3 次</strong>後，該裝置將被暫時鎖定 <strong>15 分鐘</strong>，期間無法進行同步操作。此機制用於防止暴力破解與異常請求。</LI>
                <LI><strong>IP 速率限制：</strong>登入端點每分鐘每個 IP 最多發送 <strong>10 次</strong>請求，超過則暫時封鎖（HTTP 429）。</LI>
            </ul>
            <P>同步取回的課表、成績等資料<strong>僅存放於您的裝置本機</strong>（Web Storage / IndexedDB），不上傳至本應用程式的後端伺服器或任何第三方雲端服務。您可隨時透過「設定 → 清除資料與登出」清除所有本機資料。</P>

            <H2>五、第三方服務</H2>
            <P>本應用程式使用以下第三方服務，各服務均有其獨立的隱私政策：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI><strong>雲端資料服務：</strong>用於儲存公告、意見回饋、共享平台貼文及匿名使用分析事件。</LI>
                <LI><strong>後端雲端託管平台：</strong>本應用程式後端 API 服務的雲端部署環境。</LI>
                <LI><strong>TDX 運輸資料流通服務（交通部）：</strong>提供公車即時到站資訊，本應用程式不向 TDX 傳送任何個人資料。</LI>
                <LI><strong>靜宜大學 E 校園服務網：</strong>提供課表、成績、圖書館等校務資料，本應用程式以您的帳密代理登入。</LI>
            </ul>
            <P>本應用程式不對上述第三方的資料處理方式負責，請自行參閱各服務的隱私政策。</P>

            <H2>六、Cookie 與本地儲存</H2>
            <P>本應用程式<strong>不使用任何第三方追蹤 Cookie</strong>。僅使用瀏覽器的 localStorage / sessionStorage 儲存應用程式設定（主題、已讀公告等）及校務資料快取。所有資料保存於您的裝置本機，可隨時清除。</P>

            <H2>七、資料安全措施</H2>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>所有 API 通訊均透過 HTTPS 加密傳輸，生產環境強制重導向</LI>
                <LI>登入端點速率限制：每 IP 每分鐘最多 10 次為限</LI>
                <LI>已知惡意機器人、AI 爬蟲（GPTBot、ClaudeBot 等）及安全掃描工具封鎖機制</LI>
                <LI>robots.txt 禁止所有搜尋引擎及 AI 訓練爬蟲索引本應用程式</LI>
            </ul>

            <H2>八、資料保留與刪除</H2>
            <P><strong>本機資料：</strong>可隨時於「設定 → 清除資料與登出」清除。<strong>伺服器端校園 Session：</strong>最長保留 30 分鐘，伺服器重啟後自動清空；帳號密碼從未存放，無需清除。<strong>意見回饋與共享平台內容：</strong>由管理員於後端雲端服務中管理，如需刪除請透過意見回饋功能聯繫。<strong>匿名分析事件：</strong>不含個人資訊，不提供個別刪除。</P>

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
            <P>本應用程式為<strong>非官方學生自製工具</strong>，由靜宜大學學生個人以學習為目的開發，與靜宜大學及其附屬單位無任何直接關係，亦未獲得學校官方授權。本應用程式整合 E 校園服務網等校方系統資訊，資料準確性以學校官方系統為準，本應用程式不對資料之準確性、即時性或完整性作任何保證。</P>

            <H2>二、使用資格</H2>
            <P>本應用程式主要供靜宜大學在校學生使用，其他人員亦可使用非需登入的公開功能（如公車資訊、共享平台查詢）。使用本應用程式即代表您具備完整的民事行為能力，或已取得法定代理人同意。</P>

            <H2>三、E校園帳號使用規範</H2>
            <P>使用本應用程式登入 E 校園功能時，您同意：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>僅使用您本人的 E 校園帳號，不得使用他人帳號</LI>
                <LI>了解並接受本應用程式的帳密處理方式（詳見隱私權政策第三條）：帳號密碼驗證後立即丟棄，伺服器僅保留 30 分鐘的登入 Session，帳密本身絕不快取</LI>
                <LI>妥善保管 E 校園帳號密碼，不得與他人共用或洩漏</LI>
                <LI>若帳號遭受未授權存取，請立即聯繫學校資訊中心並更換密碼</LI>
            </ul>

            <H2>四、同步頻率限制</H2>
            <P>為保護本應用程式伺服器及靜宜大學 E 校園系統的穩定性，同步功能受以下限制約束：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI><strong>同步冷卻：</strong>每次成功同步後，同一裝置須等待 10 分鐘方可再次同步</LI>
                <LI><strong>錯誤鎖定：</strong>連續登入失敗 3 次後，裝置將被暫時鎖定 15 分鐘</LI>
                <LI><strong>IP 限制：</strong>登入端點每 IP 每分鐘最多 10 次，超過暫時封鎖</LI>
            </ul>
            <P>嘗試繞過上述限制（如使用自動化工具或模擬多個裝置），因系統流量限制，可能導致被封鎖。</P>

            <H2>五、禁止行為</H2>
            <P>使用本應用程式時，您不得：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>將本應用程式用於任何商業目的或向他人收取費用</LI>
                <LI>使用自動化工具（爬蟲、機器人）對本應用程式進行大量請求或攻擊</LI>
                <LI>嘗試繞過速率限制、身份驗證或其他安全機制</LI>
                <LI>在共享平台上發布違法、詐騙、惡意、色情或侵權內容</LI>
                <LI>利用共享平台的連結功能散布惡意程式或進行網路釣魚</LI>
                <LI>干擾或損害本應用程式或 E 校園系統的正常運作</LI>
                <LI>使用他人帳號進行登入或取得他人校務資料</LI>
            </ul>

            <H2>六、共享平台規範</H2>
            <P>使用共享平台時，您同意：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>您發布的所有內容由您本人負完全責任</LI>
                <LI>不得發布任何違反中華民國法律、侵害他人智慧財產或違反學校規定的內容</LI>
                <LI>管理員有權在未事先通知的情況下刪除違規內容</LI>
                <LI>共享內容中的連結安全性由發布者負責，點擊者應自行判斷風險</LI>
            </ul>

            <H2>七、服務可用性與免責聲明</H2>
            <P>本應用程式以「現狀」（AS-IS）提供，<strong>開發者明確聲明不作任何明示或默示之保證</strong>，包括但不限於：</P>
            <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <LI>服務不中斷、無錯誤或持續可用</LI>
                <LI>資料完整性、即時性或準確性</LI>
                <LI>服務不因學校系統變更、網路環境或不可抗力而受影響</LI>
                <LI>伺服器記憶體中的短期校園 Session 不因系統異常、入侵或意外事件而洩漏（本應用程式已採取合理安全措施，但無法提供絕對保證；帳號密碼本身從未存放於伺服器）</LI>
            </ul>
            <P><strong>因使用或無法使用本應用程式所造成的任何直接、間接、附帶、特殊或衍生損失，包括但不限於資料遺失、帳號安全問題、業務中斷等，開發者不負任何法律責任，賠償責任以零元為上限。</strong></P>
            <P>若您對上述免責條款無法接受，請勿使用需要 E 校園登入的功能。</P>

            <H2>八、與學校系統之關係</H2>
            <P>本應用程式透過公開的網頁介面代理存取 E 校園服務網，此方式與使用者本人直接存取相同。開發者不保證此存取方式永遠符合學校資訊安全政策，若學校更改系統或政策導致功能失效，開發者不負責任。使用者應自行判斷是否遵守所在學校的相關規定。</P>

            <H2>九、服務變更與終止</H2>
            <P>開發者保留在未事先通知的情況下，隨時修改、暫停或終止本應用程式全部或部分功能的權利。本應用程式為個人課餘維護，不保證長期持續運營。</P>

            <H2>十、準據法與管轄</H2>
            <P>本服務條款依照中華民國法律解釋與適用。如發生爭議，以臺灣臺中地方法院為第一審管轄法院。</P>

            <H2>十一、聯繫我們</H2>
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
