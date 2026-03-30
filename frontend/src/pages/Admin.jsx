/**
 * 管理員後台 / Admin Dashboard
 * 路徑：/#/admin（不顯示於一般導覽列）
 * Route: /#/admin (hidden from normal navigation)
 *
 * 功能 / Features:
 * - 管理員登入（Google Sheets bcrypt 驗證）
 * - 公告 CRUD（新增/編輯/刪除/重新發布）
 * - 意見回饋列表與回覆
 */
import { useState, useEffect, useCallback } from 'react';
import { api, apiError } from '../services/apiClient';

const ADMIN_TOKEN_KEY = 'piyou_admin_token';

function getStoredToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function storeToken(token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearToken() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function adminHeaders(token) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

// ── 樣式常數 / Style constants ──
const card = {
    background: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    marginBottom: '12px',
};

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text)',
    fontSize: '14px',
    boxSizing: 'border-box',
    marginBottom: '10px',
};

const btnPrimary = {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--color-brand)',
    color: 'white',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
};

const btnDanger = {
    padding: '6px 12px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--color-danger)',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer',
};

const btnGhost = {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
};

const TYPE_COLORS = {
    info: 'var(--color-brand)',
    warning: 'var(--color-warning)',
    urgent: 'var(--color-danger)',
};

const TYPE_LABELS = { info: '公告', warning: '注意', urgent: '緊急' };

/**
 * 將 UTC ISO 字串轉為 datetime-local input 所需的本地時間格式
 * Convert UTC ISO string to local datetime-local input format (YYYY-MM-DDTHH:MM)
 */
function toLocalDatetimeInput(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ══════════════════════════════════════
//  登入表單 / Login Form
// ══════════════════════════════════════
function LoginForm({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/notify/admin/login', { username, password });
            storeToken(res.data.token);
            onLogin(res.data.token, res.data.username);
        } catch (err) {
            setError(apiError(err, '登入失敗'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
            <div style={{ ...card, width: '100%', maxWidth: '360px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>披呦管理後台</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Piyou Admin Dashboard</p>
                {error && (
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', fontSize: '14px', marginBottom: '12px' }}>
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <input style={inputStyle} type="text" placeholder="管理員帳號" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                    <input style={inputStyle} type="password" placeholder="管理員密碼" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                    <button type="submit" style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }} disabled={loading}>
                        {loading ? '登入中…' : '登入'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ══════════════════════════════════════
//  公告表單 / Announcement Form
// ══════════════════════════════════════
function AnnouncementForm({ initial, onSave, onCancel }) {
    const now = toLocalDatetimeInput(new Date().toISOString());
    const [title, setTitle] = useState(initial?.title || '');
    const [body, setBody] = useState(initial?.body || '');
    const [type, setType] = useState(initial?.type || 'info');
    const [publishedAt, setPublishedAt] = useState(initial?.published_at ? toLocalDatetimeInput(initial.published_at) : now);
    const [expiresAt, setExpiresAt] = useState(initial?.expires_at ? toLocalDatetimeInput(initial.expires_at) : '');
    const [linkUrl, setLinkUrl] = useState(initial?.link_url || '');
    const [linkLabel, setLinkLabel] = useState(initial?.link_label || '');
    const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
    const [republish, setRepublish] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!title.trim()) { setError('標題不能為空'); return; }
        setSaving(true);
        setError('');
        const data = {
            title: title.trim(),
            body: body.trim(),
            type,
            target: 'all',
            published_at: new Date(publishedAt).toISOString(),
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            link_url: linkUrl.trim() || null,
            link_label: linkLabel.trim() || null,
            sort_order: Number(sortOrder) || 0,
            ...(initial ? { republish } : {}),
        };
        try {
            await onSave(data);
        } catch (err) {
            setError(apiError(err, '儲存失敗'));
        } finally {
            setSaving(false);
        }
    };

    const selectStyle = { ...inputStyle, marginBottom: '10px' };

    return (
        <div style={card}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
                {initial ? '編輯公告' : '新增公告'}
            </h3>
            {error && <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', fontSize: '13px', marginBottom: '10px' }}>{error}</div>}
            <input style={inputStyle} type="text" placeholder="標題 *" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea style={{ ...inputStyle, minHeight: '140px', resize: 'vertical', fontFamily: 'inherit' }} placeholder="內文" value={body} onChange={(e) => setBody(e.target.value)} />
            <select style={selectStyle} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="info">公告 (info)</option>
                <option value="warning">注意 (warning)</option>
                <option value="urgent">緊急 (urgent)</option>
            </select>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>發布時間</label>
            <input style={inputStyle} type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>過期時間（選填）</label>
            <input style={inputStyle} type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <input style={inputStyle} type="url" placeholder="連結 URL（選填）" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <input style={inputStyle} type="text" placeholder="連結文字（選填）" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>排序順序（數字越大越前面，預設 0）</label>
            <input style={inputStyle} type="number" placeholder="排序順序（預設 0）" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            {initial && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={republish} onChange={(e) => setRepublish(e.target.checked)} />
                    重新發布（所有用戶再次看到此公告）
                </label>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onCancel} style={{ ...btnGhost, flex: 1 }}>取消</button>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>
                    {saving ? '儲存中…' : '儲存'}
                </button>
            </div>
        </div>
    );
}

// ══════════════════════════════════════
//  展示帳號面板 / Demo Account Panel
// ══════════════════════════════════════
function DemoPanel({ token, showMsg }) {
    const [status, setStatus] = useState(null);
    const [password, setPassword] = useState('');
    const [syncId, setSyncId] = useState('');
    const [syncPw, setSyncPw] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);
    const [tasks, setTasks] = useState('');
    const [saving, setSaving] = useState('');

    const loadStatus = useCallback(async () => {
        try {
            const res = await api.get('/notify/admin/demo/status', adminHeaders(token));
            setStatus(res.data);
        } catch { setStatus(null); }
    }, [token]);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    const handleSetPassword = async () => {
        if (!password.trim()) return;
        setSaving('password');
        try {
            await api.post('/notify/admin/demo/password', { password }, adminHeaders(token));
            showMsg('展示帳號密碼已更新');
            setPassword('');
            loadStatus();
        } catch (err) {
            showMsg(apiError(err, '設定失敗'));
        } finally { setSaving(''); }
    };

    const handleSync = async () => {
        if (!syncId.trim() || !syncPw.trim()) { showMsg('請填入真實帳號帳密'); return; }
        if (!window.confirm('確定從真實帳號同步資料？此操作將覆蓋現有展示資料。')) return;
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await api.post(
                '/notify/admin/demo/sync',
                { student_id: syncId, password: syncPw },
                { ...adminHeaders(token), timeout: 120000 },
            );
            setSyncResult(res.data.results);
            setSyncId('');
            setSyncPw('');
            loadStatus();
            showMsg('同步完成');
        } catch (err) {
            showMsg(apiError(err, '同步失敗'));
        } finally { setSyncing(false); }
    };

    const handleLoadTasks = async () => {
        try {
            const res = await api.get('/notify/admin/demo/tasks', adminHeaders(token));
            setTasks(JSON.stringify(res.data.tasks || [], null, 2));
        } catch { showMsg('載入任務失敗'); }
    };

    const handleSetTasks = async () => {
        let parsed;
        try { parsed = JSON.parse(tasks); } catch { showMsg('JSON 格式錯誤'); return; }
        if (!Array.isArray(parsed)) { showMsg('tasks 必須為陣列'); return; }
        setSaving('tasks');
        try {
            await api.put('/notify/admin/demo/tasks', { tasks: parsed }, adminHeaders(token));
            showMsg(`已設定 ${parsed.length} 筆展示任務`);
        } catch (err) { showMsg(apiError(err, '設定失敗')); }
        finally { setSaving(''); }
    };

    const statusFields = [
        { key: 'password_set', label: '密碼' },
        { key: 'timetable_set', label: '課表' },
        { key: 'grades_set', label: '成績' },
        { key: 'library_set', label: '圖書館' },
        { key: 'tasks_set', label: '任務' },
    ];

    return (
        <>
            {/* 狀態 / Status */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: 0 }}>展示帳號狀態</p>
                    <button onClick={loadStatus} style={{ ...btnGhost, fontSize: '12px', padding: '4px 10px' }}>重新整理</button>
                </div>
                {status ? (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                            {statusFields.map(({ key, label }) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '14px', color: status[key] ? 'var(--color-success)' : 'var(--text-muted)' }}>
                                        {status[key] ? '✓' : '✗'}
                                    </span>
                                    <span style={{ fontSize: '13px', color: status[key] ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            展示帳號：<code style={{ fontFamily: 'monospace' }}>{status.demo_student_id}</code>
                        </p>
                    </>
                ) : (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>載入中…</p>
                )}
            </div>

            {/* 設定密碼 / Set Password */}
            <div style={card}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: '0 0 12px' }}>設定展示帳號密碼</p>
                <input
                    style={inputStyle}
                    type="password"
                    placeholder="新密碼（例：S001Test!）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                />
                <button
                    style={{ ...btnPrimary, opacity: saving === 'password' ? 0.6 : 1 }}
                    disabled={saving === 'password'}
                    onClick={handleSetPassword}
                >
                    {saving === 'password' ? '儲存中…' : '設定密碼'}
                </button>
            </div>

            {/* 從真實帳號同步 / Sync from real account */}
            <div style={{ ...card, borderLeft: '4px solid #eab308' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: '0 0 4px' }}>從真實帳號同步資料</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                    帳密僅用於本次同步，不存入任何地方。同步課表、成績、圖書館資料。
                </p>
                <input
                    style={inputStyle}
                    type="text"
                    placeholder="真實帳號學號"
                    value={syncId}
                    onChange={(e) => setSyncId(e.target.value)}
                    autoComplete="off"
                />
                <input
                    style={inputStyle}
                    type="password"
                    placeholder="真實帳號密碼"
                    value={syncPw}
                    onChange={(e) => setSyncPw(e.target.value)}
                    autoComplete="new-password"
                />
                <button
                    style={{ ...btnPrimary, opacity: syncing ? 0.6 : 1, background: '#ca8a04' }}
                    disabled={syncing}
                    onClick={handleSync}
                >
                    {syncing ? '同步中（約 30–60 秒）…' : '開始同步'}
                </button>
                {syncResult && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                        {Object.entries(syncResult).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', gap: '8px', padding: '3px 0', fontSize: '13px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: '64px' }}>{k}</span>
                                <span style={{ color: String(v).startsWith('ok') ? 'var(--color-success)' : 'var(--color-danger)' }}>{v}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 展示任務 / Demo Tasks */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: 0 }}>展示帳號任務</p>
                    <button onClick={handleLoadTasks} style={{ ...btnGhost, fontSize: '12px', padding: '4px 10px' }}>載入</button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' }}>以 JSON 陣列格式輸入任務（與前端 taskStore 格式相同）</p>
                <textarea
                    style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                    placeholder='[{"id":"1","title":"期中報告","done":false,"dueDate":null}]'
                    value={tasks}
                    onChange={(e) => setTasks(e.target.value)}
                />
                <button
                    style={{ ...btnPrimary, opacity: saving === 'tasks' ? 0.6 : 1 }}
                    disabled={saving === 'tasks'}
                    onClick={handleSetTasks}
                >
                    {saving === 'tasks' ? '儲存中…' : '儲存任務'}
                </button>
            </div>
        </>
    );
}

// ══════════════════════════════════════
//  資安面板 / Security Panel
// ══════════════════════════════════════
const SEVERITY_COLORS = {
    critical: 'var(--color-danger)',
    high: '#f97316',
    medium: '#eab308',
    low: 'var(--color-brand)',
};

const SEVERITY_ICONS = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️',
};

function SecurityPanel({ token, showMsg }) {
    const [alerts, setAlerts] = useState(null);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [maintenance, setMaintenance] = useState(null);
    const [maintMsg, setMaintMsg] = useState('');
    const [maintSaving, setMaintSaving] = useState(false);
    const [clearing, setClearing] = useState('');
    // IP 管理狀態 / IP management state
    const [ips, setIps] = useState(null);
    const [ipSummary, setIpSummary] = useState(null);
    const [ipsLoading, setIpsLoading] = useState(false);
    const [ipAction, setIpAction] = useState(''); // which IP is being acted on
    const [ipFilter, setIpFilter] = useState('all'); // 'all' | 'blocked' | 'suspicious'

    const loadAnomalies = useCallback(async () => {
        setAlertsLoading(true);
        try {
            const res = await api.get('/notify/admin/security/anomalies', adminHeaders(token));
            setAlerts(res.data.alerts || []);
        } catch {
            setAlerts([]);
        } finally {
            setAlertsLoading(false);
        }
    }, [token]);

    const loadIPs = useCallback(async () => {
        setIpsLoading(true);
        try {
            const res = await api.get('/notify/admin/security/ips', adminHeaders(token));
            setIps(res.data.ips || []);
            setIpSummary(res.data.summary || null);
        } catch {
            setIps([]);
        } finally {
            setIpsLoading(false);
        }
    }, [token]);

    const loadMaintenanceState = useCallback(async () => {
        try {
            const res = await api.get('/notify/admin/config', adminHeaders(token));
            const cfg = res.data.config || {};
            setMaintenance({ enabled: cfg.maintenance_mode === 'true', message: cfg.maintenance_message || '' });
            setMaintMsg(cfg.maintenance_message || '');
        } catch { /* ignore */ }
    }, [token]);

    useEffect(() => {
        loadAnomalies();
        loadMaintenanceState();
        loadIPs();
        const timer = setInterval(() => { loadAnomalies(); loadIPs(); }, 60_000);
        return () => clearInterval(timer);
    }, [loadAnomalies, loadMaintenanceState, loadIPs]);

    const handleToggleMaintenance = async (enable) => {
        if (enable && !window.confirm(`確定開啟維護模式？前端所有使用者將看到維護頁面！`)) return;
        setMaintSaving(true);
        try {
            await api.post('/notify/admin/maintenance', { enabled: enable, message: maintMsg }, adminHeaders(token));
            setMaintenance({ enabled: enable, message: maintMsg });
            showMsg(enable ? '維護模式已開啟' : '維護模式已關閉');
        } catch (err) {
            showMsg(err.response?.data?.detail || '操作失敗');
        } finally {
            setMaintSaving(false);
        }
    };

    const handleClearData = async (dataType, label) => {
        if (!window.confirm(`確定清除「${label}」資料？此操作無法復原！`)) return;
        if (!window.confirm(`再次確認：清除所有${label}資料？`)) return;
        setClearing(dataType);
        try {
            const res = await api.delete(`/notify/admin/data/${dataType}`, adminHeaders(token));
            showMsg(`已清除 ${res.data.deleted_rows} 筆${label}資料`);
        } catch (err) {
            showMsg(err.response?.data?.detail || '清除失敗');
        } finally {
            setClearing('');
        }
    };

    const handleBlockIP = async (ip) => {
        if (!window.confirm(`確定封鎖 IP ${ip}？`)) return;
        setIpAction(ip);
        try {
            await api.post(`/notify/admin/security/ips/${encodeURIComponent(ip)}/block`, { reason: 'manual' }, adminHeaders(token));
            showMsg(`已封鎖 IP: ${ip}`);
            await loadIPs();
        } catch (err) {
            showMsg(err.response?.data?.detail || '封鎖失敗');
        } finally {
            setIpAction('');
        }
    };

    const handleUnblockIP = async (ip) => {
        setIpAction(ip);
        try {
            await api.post(`/notify/admin/security/ips/${encodeURIComponent(ip)}/unblock`, {}, adminHeaders(token));
            showMsg(`已解除封鎖 IP: ${ip}`);
            await loadIPs();
        } catch (err) {
            showMsg(err.response?.data?.detail || '解除失敗');
        } finally {
            setIpAction('');
        }
    };

    const filteredIps = (ips || []).filter(ip => {
        if (ipFilter === 'blocked') return ip.blocked;
        if (ipFilter === 'suspicious') return !ip.blocked && (ip.waf_count + ip.bot_count + ip.path_count) >= 3;
        return true;
    });

    const isSuspicious = (ip) => !ip.blocked && (ip.waf_count + ip.bot_count + ip.path_count) >= 3;

    const formatTime = (iso) => {
        if (!iso) return '—';
        try { return new Date(iso).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
        catch { return iso; }
    };

    return (
        <>
            {/* 安全統計概覽 / Security Stats Overview */}
            {ipSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {[
                        { label: '追蹤 IP', value: ipSummary.total_ips, color: 'var(--color-brand)' },
                        { label: '已封鎖', value: ipSummary.blocked_count, color: 'var(--color-danger)' },
                        { label: '可疑 IP', value: ipSummary.suspicious_count, color: '#f97316' },
                        { label: 'WAF 攔截', value: ipSummary.total_waf_violations, color: '#eab308' },
                        { label: 'Bot 封鎖', value: ipSummary.total_bot_blocks, color: '#f97316' },
                        { label: '敏感路徑探測', value: ipSummary.total_sensitive_path_probes, color: '#eab308' },
                    ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: 'var(--bg-card)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* AI 異常告警 */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: 0 }}>AI 異常告警</p>
                    <button onClick={loadAnomalies} disabled={alertsLoading} style={{ ...btnGhost, fontSize: '12px', padding: '4px 10px' }}>
                        {alertsLoading ? '偵測中…' : '重新偵測'}
                    </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                    每 60 秒自動更新 · 涵蓋前端事件 + WAF 違規 + Bot 偵測 + 速率限制
                </p>
                {alertsLoading && alerts === null && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>偵測中…</p>
                )}
                {alerts !== null && alerts.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)' }}>
                        <span style={{ fontSize: '16px' }}>✓</span>
                        <span style={{ fontSize: '13px', color: 'var(--color-success)' }}>目前無異常，系統運作正常</span>
                    </div>
                )}
                {alerts !== null && alerts.map((alert, i) => (
                    <div key={i} style={{
                        borderLeft: `3px solid ${SEVERITY_COLORS[alert.severity] || 'var(--border)'}`,
                        paddingLeft: '10px', marginBottom: '10px',
                        padding: '8px 10px',
                        borderRadius: '0 8px 8px 0',
                        background: `${SEVERITY_COLORS[alert.severity]}10` || 'var(--bg-input)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13px' }}>{SEVERITY_ICONS[alert.severity] || '•'}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: SEVERITY_COLORS[alert.severity], textTransform: 'uppercase' }}>
                                {alert.severity}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{alert.title}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px' }}>{alert.message}</p>
                    </div>
                ))}
            </div>

            {/* IP 管理 / IP Management */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: 0 }}>IP 管理</p>
                    <button onClick={loadIPs} disabled={ipsLoading} style={{ ...btnGhost, fontSize: '12px', padding: '4px 10px' }}>
                        {ipsLoading ? '載入中…' : '重新整理'}
                    </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                    列出所有曾連線 IP · 可手動封鎖或開放 · 重啟後重置（記憶體儲存）
                </p>

                {/* 篩選器 / Filter */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {[
                        { key: 'all', label: `全部 (${(ips || []).length})` },
                        { key: 'suspicious', label: `可疑 (${(ips || []).filter(isSuspicious).length})`, color: '#f97316' },
                        { key: 'blocked', label: `已封鎖 (${(ips || []).filter(i => i.blocked).length})`, color: 'var(--color-danger)' },
                    ].map(({ key, label, color }) => (
                        <button
                            key={key}
                            onClick={() => setIpFilter(key)}
                            style={{
                                padding: '4px 10px', borderRadius: '6px', border: `1px solid ${ipFilter === key ? (color || 'var(--color-brand)') : 'var(--border)'}`,
                                background: ipFilter === key ? `${(color || 'var(--color-brand)')}22` : 'var(--bg-input)',
                                color: ipFilter === key ? (color || 'var(--color-brand)') : 'var(--text-muted)',
                                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                            }}
                        >{label}</button>
                    ))}
                </div>

                {ipsLoading && ips === null && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>載入中…</p>
                )}
                {ips !== null && filteredIps.length === 0 && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                        {ipFilter === 'all' ? '尚無連線記錄' : '此分類無資料'}
                    </p>
                )}
                {filteredIps.map((ipRec) => {
                    const threat = ipRec.waf_count + ipRec.bot_count + ipRec.path_count;
                    const rowColor = ipRec.blocked
                        ? 'rgba(239,68,68,0.06)'
                        : threat >= 3 ? 'rgba(249,115,22,0.06)' : 'transparent';
                    const borderColor = ipRec.blocked ? 'var(--color-danger)' : threat >= 3 ? '#f97316' : 'var(--border)';
                    return (
                        <div key={ipRec.ip} style={{
                            border: `1px solid ${borderColor}`,
                            borderRadius: '8px',
                            padding: '10px 12px',
                            marginBottom: '8px',
                            background: rowColor,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{ipRec.ip}</span>
                                        {ipRec.blocked && (
                                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)', fontWeight: 700 }}>
                                                封鎖中 {ipRec.blocked_reason ? `(${ipRec.blocked_reason})` : ''}
                                            </span>
                                        )}
                                        {!ipRec.blocked && threat >= 3 && (
                                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(249,115,22,0.15)', color: '#f97316', fontWeight: 700 }}>
                                                可疑
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>請求: <b>{ipRec.request_count}</b></span>
                                        {ipRec.waf_count > 0 && <span style={{ fontSize: '11px', color: '#eab308' }}>WAF: <b>{ipRec.waf_count}</b></span>}
                                        {ipRec.bot_count > 0 && <span style={{ fontSize: '11px', color: '#f97316' }}>Bot: <b>{ipRec.bot_count}</b></span>}
                                        {ipRec.path_count > 0 && <span style={{ fontSize: '11px', color: '#f97316' }}>路徑探測: <b>{ipRec.path_count}</b></span>}
                                        {ipRec.rate_limit_hits > 0 && <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>速限: <b>{ipRec.rate_limit_hits}</b></span>}
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>最後: {formatTime(ipRec.last_seen)}</span>
                                    </div>
                                </div>
                                <div>
                                    {ipRec.blocked ? (
                                        <button
                                            disabled={ipAction === ipRec.ip}
                                            onClick={() => handleUnblockIP(ipRec.ip)}
                                            style={{ ...btnGhost, fontSize: '11px', padding: '4px 10px', opacity: ipAction === ipRec.ip ? 0.5 : 1 }}
                                        >
                                            {ipAction === ipRec.ip ? '處理中…' : '解除封鎖'}
                                        </button>
                                    ) : (
                                        <button
                                            disabled={ipAction === ipRec.ip}
                                            onClick={() => handleBlockIP(ipRec.ip)}
                                            style={{ ...btnDanger, fontSize: '11px', padding: '4px 10px', opacity: ipAction === ipRec.ip ? 0.5 : 1 }}
                                        >
                                            {ipAction === ipRec.ip ? '處理中…' : '封鎖'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 維護模式 */}
            <div style={{ ...card, borderLeft: maintenance?.enabled ? '4px solid var(--color-danger)' : '4px solid var(--border)' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: '0 0 6px' }}>緊急維護模式</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                    開啟後前端所有使用者將看到維護頁面，無法使用任何功能。
                </p>
                {maintenance !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '10px', borderRadius: '10px', background: maintenance.enabled ? 'rgba(239,68,68,0.08)' : 'var(--bg-input)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: maintenance.enabled ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {maintenance.enabled ? '🔴 維護模式進行中' : '🟢 系統正常運行'}
                        </span>
                    </div>
                )}
                <textarea
                    style={{ ...inputStyle, minHeight: '56px', resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="維護訊息（顯示給用戶，選填）"
                    value={maintMsg}
                    maxLength={200}
                    onChange={(e) => setMaintMsg(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        disabled={maintSaving || maintenance?.enabled === false}
                        onClick={() => handleToggleMaintenance(false)}
                        style={{ ...btnGhost, flex: 1, opacity: (maintSaving || maintenance?.enabled === false) ? 0.5 : 1 }}
                    >
                        {maintSaving ? '處理中…' : '關閉維護'}
                    </button>
                    <button
                        disabled={maintSaving || maintenance?.enabled === true}
                        onClick={() => handleToggleMaintenance(true)}
                        style={{ ...btnDanger, flex: 1, padding: '10px', opacity: (maintSaving || maintenance?.enabled === true) ? 0.5 : 1 }}
                    >
                        {maintSaving ? '處理中…' : '緊急關閉系統'}
                    </button>
                </div>
            </div>

            {/* 資料清除 */}
            <div style={card}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: '0 0 6px' }}>資料清除</p>
                <p style={{ fontSize: '12px', color: 'var(--color-danger)', margin: '0 0 12px' }}>警告：此操作不可復原，清除後資料永久刪除。</p>
                {[
                    { type: 'analytics', label: '分析事件', desc: '所有 analytics_events 資料列' },
                    { type: 'shares', label: '共享平台貼文', desc: '所有 shared_items 資料列' },
                    { type: 'usersync', label: '跨裝置同步', desc: '所有 user_sync 資料列' },
                    { type: 'feedback', label: '意見回饋', desc: '所有 feedback 資料列' },
                ].map(({ type, label, desc }) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{desc}</span>
                        </div>
                        <button
                            disabled={!!clearing}
                            onClick={() => handleClearData(type, label)}
                            style={{ ...btnDanger, fontSize: '12px', padding: '6px 12px', opacity: clearing ? 0.5 : 1 }}
                        >
                            {clearing === type ? '清除中…' : '清除'}
                        </button>
                    </div>
                ))}
            </div>
        </>
    );
}

// ══════════════════════════════════════
//  主後台 / Main Dashboard
// ══════════════════════════════════════
export default function Admin() {
    const [token, setToken] = useState(getStoredToken);
    const [adminName, setAdminName] = useState('');
    const [tab, setTab] = useState('announcements'); // 'announcements' | 'feedback' | 'shares' | 'analytics' | 'config' | 'security'
    const [announcements, setAnnouncements] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [shares, setShares] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [replyingId, setReplyingId] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [msg, setMsg] = useState('');

    const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

    const handleLogin = (t, name) => { setToken(t); setAdminName(name); };
    const handleLogout = () => { clearToken(); setToken(''); setAdminName(''); };

    const loadAnnouncements = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await api.get('/notify/admin/announcements', adminHeaders(token));
            setAnnouncements(res.data.announcements || []);
        } catch (err) {
            if (err.response?.status === 403) handleLogout();
        } finally {
            setLoading(false);
        }
    }, [token]);

    const loadFeedback = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await api.get('/notify/admin/feedback', adminHeaders(token));
            setFeedback(res.data.feedback || []);
        } catch (err) {
            if (err.response?.status === 403) handleLogout();
        } finally {
            setLoading(false);
        }
    }, [token]);

    const [shareStats, setShareStats] = useState(null);
    const [appConfig, setAppConfig] = useState(null);
    const [configSaving, setConfigSaving] = useState(false);

    const loadShares = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await api.get('/notify/admin/shares', adminHeaders(token));
            setShares(res.data.shares || []);
            setShareStats({ total: res.data.total, active: res.data.active, password_protected: res.data.password_protected });
        } catch (err) {
            if (err.response?.status === 403) handleLogout();
        } finally {
            setLoading(false);
        }
    }, [token]);

    const loadConfig = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await api.get('/notify/admin/config', adminHeaders(token));
            setAppConfig(res.data.config || {});
        } catch (err) {
            if (err.response?.status === 403) handleLogout();
        } finally {
            setLoading(false);
        }
    }, [token]);

    const loadAnalytics = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await api.get('/notify/admin/analytics', adminHeaders(token));
            setAnalytics(res.data);
        } catch (err) {
            if (err.response?.status === 403) handleLogout();
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            if (tab === 'announcements') loadAnnouncements();
            else if (tab === 'feedback') loadFeedback();
            else if (tab === 'shares') loadShares();
            else if (tab === 'analytics') loadAnalytics();
            else if (tab === 'config') loadConfig();
        }
    }, [token, tab, loadAnnouncements, loadFeedback, loadShares, loadAnalytics, loadConfig]);

    const handleCreate = async (data) => {
        await api.post('/notify/admin/announcements', data, adminHeaders(token));
        setShowCreateForm(false);
        await loadAnnouncements();
        showMsg('公告已新增');
    };

    const handleUpdate = async (id, data) => {
        await api.put(`/notify/admin/announcements/${id}`, data, adminHeaders(token));
        setEditingId(null);
        await loadAnnouncements();
        showMsg('公告已更新');
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`確定刪除「${title}」？`)) return;
        await api.delete(`/notify/admin/announcements/${id}`, adminHeaders(token));
        await loadAnnouncements();
        showMsg('公告已刪除');
    };

    const handleReply = async (id) => {
        if (!replyText.trim()) return;
        await api.put(`/notify/admin/feedback/${id}/reply`, { reply: replyText }, adminHeaders(token));
        setReplyingId(null);
        setReplyText('');
        await loadFeedback();
        showMsg('回覆已儲存');
    };

    if (!token) return <LoginForm onLogin={handleLogin} />;

    const editingAnn = editingId ? announcements.find((a) => a.id === editingId) : null;

    return (
        <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg)', padding: '16px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>披呦管理後台</h1>
                    {adminName && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{adminName}</p>}
                </div>
                <button onClick={handleLogout} style={btnGhost}>登出</button>
            </div>

            {/* Toast */}
            {msg && (
                <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'var(--color-success)', color: 'white', fontSize: '14px', marginBottom: '12px' }}>
                    {msg}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {['announcements', 'feedback', 'shares', 'analytics', 'config', 'security', 'demo'].map((t) => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: tab === t ? (t === 'security' ? 'var(--color-danger)' : t === 'demo' ? '#ca8a04' : 'var(--color-brand)') : 'var(--bg-input)',
                        color: tab === t ? 'white' : 'var(--text-secondary)',
                        fontWeight: tab === t ? 600 : 400, fontSize: '14px',
                    }}>
                        {t === 'announcements' ? '公告管理' : t === 'feedback' ? '意見回饋' : t === 'shares' ? '共享平台' : t === 'analytics' ? '使用統計' : t === 'config' ? '系統設定' : t === 'security' ? '資安面板' : '展示帳號'}
                    </button>
                ))}
            </div>

            {/* Announcements Tab */}
            {tab === 'announcements' && (
                <>
                    {!showCreateForm && !editingId && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <button onClick={() => setShowCreateForm(true)} style={{ ...btnPrimary, flex: 1 }}>
                                + 新增公告
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await api.post('/notify/admin/announcements/invalidate', {}, adminHeaders(token));
                                        showMsg('快取已清除，重新載入中…');
                                        await loadAnnouncements();
                                    } catch (err) {
                                        showMsg(apiError(err, '刷新失敗'));
                                    }
                                }}
                                style={{ ...btnGhost, whiteSpace: 'nowrap' }}
                                title="若直接修改試算表後公告未更新，點此強制刷新快取"
                            >
                                刷新快取
                            </button>
                        </div>
                    )}
                    {showCreateForm && (
                        <AnnouncementForm onSave={handleCreate} onCancel={() => setShowCreateForm(false)} />
                    )}
                    {editingAnn && (
                        <AnnouncementForm
                            initial={editingAnn}
                            onSave={(data) => handleUpdate(editingId, data)}
                            onCancel={() => setEditingId(null)}
                        />
                    )}
                    {loading && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>載入中…</p>}
                    {!loading && !showCreateForm && !editingId && announcements.map((ann) => {
                        const isScheduled = ann._is_scheduled;
                        const isExpired = ann._is_expired;
                        const isDraft = ann._is_draft;
                        const borderColor = isScheduled ? '#8b5cf6' : isExpired ? 'var(--text-muted)' : isDraft ? '#6b7280' : (TYPE_COLORS[ann.type] || TYPE_COLORS.info);
                        return (
                            <div key={ann.id} style={{ ...card, borderLeft: `4px solid ${borderColor}`, opacity: (isExpired || isDraft) ? 0.7 : 1 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: TYPE_COLORS[ann.type] || TYPE_COLORS.info }}>
                                                {TYPE_LABELS[ann.type] || ann.type}
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>v{ann.version || 1}</span>
                                            {isScheduled && (
                                                <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', padding: '1px 6px', borderRadius: '999px' }}>
                                                    排程中
                                                </span>
                                            )}
                                            {isExpired && (
                                                <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(107,114,128,0.15)', color: '#6b7280', padding: '1px 6px', borderRadius: '999px' }}>
                                                    已過期
                                                </span>
                                            )}
                                            {isDraft && (
                                                <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(107,114,128,0.12)', color: '#9ca3af', padding: '1px 6px', borderRadius: '999px' }}>
                                                    草稿
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px', margin: '0 0 4px' }}>{ann.title}</p>
                                        {ann.body && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px', whiteSpace: 'pre-line' }}>{ann.body}</p>}
                                        <p style={{ fontSize: '11px', color: isScheduled ? '#8b5cf6' : 'var(--text-muted)', margin: 0 }}>
                                            {ann.published_at ? new Date(ann.published_at).toLocaleString('zh-TW') : '（未設定發布時間）'}
                                            {ann.expires_at && ` → ${new Date(ann.expires_at).toLocaleString('zh-TW')}`}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                                        <button onClick={() => { setEditingId(ann.id); setShowCreateForm(false); }} style={btnGhost}>編輯</button>
                                        <button onClick={() => handleDelete(ann.id, ann.title)} style={btnDanger}>刪除</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {!loading && !showCreateForm && !editingId && announcements.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>目前沒有公告</p>
                    )}
                </>
            )}

            {/* Feedback Tab */}
            {tab === 'feedback' && (
                <>
                    <button onClick={loadFeedback} style={{ ...btnGhost, marginBottom: '12px' }}>重新整理</button>
                    {loading && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>載入中…</p>}
                    {!loading && feedback.map((fb) => (
                        <div key={fb.id} style={{ ...card, borderLeft: `4px solid ${fb.status === 'replied' ? 'var(--color-success)' : 'var(--border)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: fb.status === 'replied' ? 'var(--color-success)' : 'var(--text-muted)' }}>
                                    {fb.status === 'replied' ? '已回覆' : '待處理'} · {fb.category}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {fb.submitted_at ? new Date(fb.submitted_at).toLocaleString('zh-TW') : ''}
                                </span>
                            </div>
                            <p style={{ fontSize: '14px', color: 'var(--text)', margin: '0 0 6px', whiteSpace: 'pre-line' }}>{fb.content}</p>
                            {fb.contact && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 6px' }}>聯絡：{fb.contact}</p>}
                            {fb.admin_reply && (
                                <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-input)', marginBottom: '8px' }}>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 2px' }}>管理員回覆</p>
                                    <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0 }}>{fb.admin_reply}</p>
                                </div>
                            )}
                            {replyingId === fb.id ? (
                                <div>
                                    <textarea
                                        style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                                        placeholder="輸入回覆…"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => { setReplyingId(null); setReplyText(''); }} style={{ ...btnGhost, flex: 1 }}>取消</button>
                                        <button onClick={() => handleReply(fb.id)} style={{ ...btnPrimary, flex: 2 }}>送出回覆</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => { setReplyingId(fb.id); setReplyText(fb.admin_reply || ''); }} style={btnGhost}>
                                    {fb.admin_reply ? '修改回覆' : '回覆'}
                                </button>
                            )}
                        </div>
                    ))}
                    {!loading && feedback.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>目前沒有回饋</p>
                    )}
                </>
            )}

            {/* Shares Tab */}
            {tab === 'shares' && (
                <>
                    <button onClick={loadShares} style={{ ...btnGhost, marginBottom: '12px' }}>重新整理</button>
                    {!loading && shareStats && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                            {[
                                { label: '總分享數', value: shareStats.total },
                                { label: '有效分享', value: shareStats.active },
                                { label: '密碼保護', value: shareStats.password_protected },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
                                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-brand)' }}>{value}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {loading && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>載入中…</p>}
                    {!loading && shares.map((s) => (
                        <div key={s.code} style={{ ...card, borderLeft: `4px solid ${s.deleted ? 'var(--color-danger)' : 'var(--color-brand)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.code}</span>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {s.password_protected && (
                                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-warning, #b45309)', background: 'var(--color-warning-bg, #fef3c7)', borderRadius: '4px', padding: '1px 6px' }}>🔒 密碼</span>
                                    )}
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: s.deleted ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                        {s.deleted ? '已刪除' : '有效'}
                                    </span>
                                </div>
                            </div>
                            <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px', margin: '0 0 4px' }}>{s.title}</p>
                            {s.body && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px', whiteSpace: 'pre-line' }}>{s.body}</p>}
                            {s.link_urls?.length > 0 && (
                                <p style={{ fontSize: '12px', color: 'var(--color-brand)', margin: '0 0 4px', wordBreak: 'break-all' }}>{s.link_urls.join(', ')}</p>
                            )}
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                                裝置：{s.device_id_hash} · {s.created_at ? new Date(s.created_at).toLocaleString('zh-TW') : ''}
                            </p>
                        </div>
                    ))}
                    {!loading && shares.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>目前沒有共享資料</p>
                    )}
                </>
            )}

            {/* Analytics Tab */}
            {tab === 'analytics' && (
                <>
                    <button onClick={loadAnalytics} style={{ ...btnGhost, marginBottom: '12px' }}>重新整理（5 分鐘快取）</button>
                    {loading && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>載入中…</p>}
                    {!loading && analytics && (
                        <>
                            {/* 活躍人數 / Active users by time period */}
                            <div style={{ ...card, marginBottom: '12px' }}>
                                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 10px' }}>活躍裝置數</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                    {[
                                        { label: '近 1 小時', value: analytics.unique_devices_hour ?? '—' },
                                        { label: '今日', value: analytics.unique_devices_today },
                                        { label: '近 7 天', value: analytics.unique_devices_week ?? '—' },
                                        { label: '近 30 天', value: analytics.unique_devices_month ?? '—' },
                                    ].map(({ label, value }) => (
                                        <div key={label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: '10px', background: 'var(--bg-input)' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-brand)' }}>{value}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 平台裝置分類 / Platform breakdown */}
                            {analytics.platform_breakdown && (
                                <div style={{ ...card, marginBottom: '12px' }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 10px' }}>裝置平台分類（累計獨立裝置）</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                        {[
                                            { label: '手機', key: 'mobile', icon: '📱', color: '#10b981' },
                                            { label: '平板', key: 'tablet', icon: '📊', color: '#3b82f6' },
                                            { label: '電腦', key: 'desktop', icon: '💻', color: '#8b5cf6' },
                                            { label: '未知', key: 'unknown', icon: '❓', color: '#6b7280' },
                                        ].map(({ label, key, icon, color }) => (
                                            <div key={key} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: '10px', background: 'var(--bg-input)' }}>
                                                <div style={{ fontSize: '16px', marginBottom: '2px' }}>{icon}</div>
                                                <div style={{ fontSize: '18px', fontWeight: 700, color }}>{analytics.platform_breakdown[key] ?? 0}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {(analytics.platform_breakdown.unknown ?? 0) > 0 && (
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0', textAlign: 'center' }}>
                                            未知裝置為舊版資料（平台識別功能上線前已記錄）
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* 摘要卡片 / Summary cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                {[
                                    { label: '今日事件', value: analytics.today_events },
                                    { label: '累計裝置', value: analytics.unique_devices_total },
                                    { label: '累計事件', value: analytics.total_events },
                                    { label: '跨裝置帳號', value: analytics.usersync_accounts ?? '—' },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
                                        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-brand)' }}>{value}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* 同步統計 */}
                            {analytics.sync_total > 0 && (
                                <div style={{ ...card }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 8px' }}>校務同步</p>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--color-success)' }}>成功 {analytics.sync_success}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--color-danger)' }}>失敗 {analytics.sync_fail}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            成功率 {analytics.sync_total > 0 ? Math.round(analytics.sync_success / analytics.sync_total * 100) : 0}%
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* 公車取得統計 */}
                            {(analytics.bus_fetch_total ?? 0) > 0 && (
                                <div style={{ ...card }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 8px' }}>公車資料取得</p>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>自動 {analytics.bus_fetch_auto ?? 0}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--color-brand)' }}>手動 {analytics.bus_fetch_manual ?? 0}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>總計 {analytics.bus_fetch_total}</span>
                                    </div>
                                </div>
                            )}

                            {/* 通知彈窗統計 */}
                            {(analytics.notify_popup_total ?? 0) > 0 && (
                                <div style={{ ...card }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 4px' }}>通知彈窗</p>
                                    <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-brand)' }}>{analytics.notify_popup_total}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>次</span>
                                </div>
                            )}

                            {/* 按鈕點擊明細 */}
                            {analytics.button_clicks?.length > 0 && (
                                <div style={{ ...card }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 8px' }}>按鈕點擊明細</p>
                                    {analytics.button_clicks.map((bc) => (
                                        <div key={bc.action} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{bc.action}</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{bc.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 頁面瀏覽排行 */}
                            {analytics.page_views.length > 0 && (
                                <div style={{ ...card }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 10px' }}>頁面瀏覽排行</p>
                                    {analytics.page_views.map((pv) => {
                                        const max = analytics.page_views[0]?.count || 1;
                                        return (
                                            <div key={pv.page} style={{ marginBottom: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>{pv.label}</span>
                                                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{pv.count}</span>
                                                </div>
                                                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: '3px', background: 'var(--color-brand)', width: `${Math.round(pv.count / max * 100)}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 功能使用次數 */}
                            {analytics.event_counts.length > 0 && (
                                <div style={{ ...card }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 8px' }}>功能使用次數</p>
                                    {analytics.event_counts.map((ev) => (
                                        <div key={ev.event} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{ev.label}</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ev.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 近期錯誤 */}
                            {analytics.recent_errors.length > 0 && (
                                <div style={{ ...card }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 8px' }}>
                                        近期前端錯誤（最新 {analytics.recent_errors.length} 筆）
                                    </p>
                                    {analytics.recent_errors.map((err, i) => (
                                        <div key={i} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '8px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                                                {err.ts ? new Date(err.ts).toLocaleString('zh-TW') : ''} · {err.page}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--color-danger)', wordBreak: 'break-all' }}>{err.message || '（無訊息）'}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 詳細活動紀錄 / Detailed activity log */}
                            {analytics.recent_events?.length > 0 && (
                                <div style={{ ...card }}>
                                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 8px' }}>
                                        詳細活動紀錄（最新 {analytics.recent_events.length} 筆）
                                    </p>
                                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                                        {analytics.recent_events.map((ev, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                                padding: '6px 0', borderBottom: '1px solid var(--border-subtle)',
                                                fontSize: '12px',
                                            }}>
                                                <span style={{ color: 'var(--text-muted)', flexShrink: 0, lineHeight: '1.4' }}>
                                                    {ev.ts ? new Date(ev.ts).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </span>
                                                <span style={{
                                                    flexShrink: 0, padding: '1px 6px', borderRadius: '4px', fontWeight: 600,
                                                    fontSize: '11px', lineHeight: '1.4',
                                                    background: ev.event_type === 'error' ? 'rgba(239,68,68,0.12)' :
                                                        ev.event_type === 'sync' ? 'rgba(16,185,129,0.12)' :
                                                        'rgba(99,102,241,0.1)',
                                                    color: ev.event_type === 'error' ? 'var(--color-danger)' :
                                                        ev.event_type === 'sync' ? 'var(--color-success)' :
                                                        'var(--color-brand)',
                                                }}>
                                                    {ev.event_label || ev.event_type}
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)', flex: 1, lineHeight: '1.4' }}>
                                                    {ev.page_label || ev.page || '—'}
                                                    {ev.event_type === 'sync' && ev.extra?.status && (
                                                        <span style={{ color: ev.extra.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)', marginLeft: '4px' }}>
                                                            {ev.extra.status === 'success' ? '✓' : '✗'}
                                                        </span>
                                                    )}
                                                    {ev.event_type === 'error' && ev.extra?.message && (
                                                        <span style={{ color: 'var(--color-danger)', marginLeft: '4px', wordBreak: 'break-all' }}>
                                                            {String(ev.extra.message).slice(0, 80)}
                                                        </span>
                                                    )}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px', flexShrink: 0 }}>
                                                    {ev.device?.slice(0, 8)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                                資料更新時間：{analytics.generated_at ? new Date(analytics.generated_at).toLocaleString('zh-TW') : '—'}
                            </p>
                        </>
                    )}
                    {!loading && !analytics && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>尚無統計資料</p>
                    )}
                </>
            )}

            {/* Security Tab */}
            {tab === 'security' && (
                <SecurityPanel token={token} showMsg={showMsg} />
            )}

            {/* Demo Tab */}
            {tab === 'demo' && (
                <DemoPanel token={token} showMsg={showMsg} />
            )}

            {/* Config Tab */}
            {tab === 'config' && (
                <>
                    <button onClick={loadConfig} style={{ ...btnGhost, marginBottom: '12px' }}>重新整理</button>
                    {loading && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>載入中…</p>}
                    {!loading && appConfig && (
                        <div style={card}>
                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', margin: '0 0 16px' }}>應用程式設定</p>
                            {[
                                { key: 'version', label: '版本號', placeholder: '例：1.0.0-beta' },
                            ].map(({ key, label, placeholder }) => (
                                <div key={key} style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{label}</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                                            value={appConfig[key] ?? ''}
                                            placeholder={placeholder}
                                            maxLength={100}
                                            onChange={(e) => setAppConfig((c) => ({ ...c, [key]: e.target.value }))}
                                        />
                                        <button
                                            disabled={configSaving}
                                            style={{ ...btnPrimary, width: 'auto', padding: '10px 20px', opacity: configSaving ? 0.6 : 1 }}
                                            onClick={async () => {
                                                setConfigSaving(true);
                                                try {
                                                    await api.put('/notify/admin/config', { key, value: appConfig[key] ?? '' }, adminHeaders(token));
                                                    showMsg(`${label}已更新`);
                                                } catch (err) {
                                                    showMsg(err.response?.data?.detail || '更新失敗');
                                                } finally {
                                                    setConfigSaving(false);
                                                }
                                            }}
                                        >
                                            {configSaving ? '儲存中…' : '儲存'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!loading && !appConfig && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>無法載入設定</p>
                    )}
                </>
            )}
        </div>
    );
}
