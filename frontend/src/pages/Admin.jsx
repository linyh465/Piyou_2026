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
    const now = new Date().toISOString().slice(0, 16);
    const [title, setTitle] = useState(initial?.title || '');
    const [body, setBody] = useState(initial?.body || '');
    const [type, setType] = useState(initial?.type || 'info');
    const [publishedAt, setPublishedAt] = useState(initial?.published_at?.slice(0, 16) || now);
    const [expiresAt, setExpiresAt] = useState(initial?.expires_at?.slice(0, 16) || '');
    const [linkUrl, setLinkUrl] = useState(initial?.link_url || '');
    const [linkLabel, setLinkLabel] = useState(initial?.link_label || '');
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
            <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} placeholder="內文" value={body} onChange={(e) => setBody(e.target.value)} />
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
//  主後台 / Main Dashboard
// ══════════════════════════════════════
export default function Admin() {
    const [token, setToken] = useState(getStoredToken);
    const [adminName, setAdminName] = useState('');
    const [tab, setTab] = useState('announcements'); // 'announcements' | 'feedback' | 'shares' | 'analytics'
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
        }
    }, [token, tab, loadAnnouncements, loadFeedback, loadShares, loadAnalytics]);

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
                {['announcements', 'feedback', 'shares', 'analytics'].map((t) => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: tab === t ? 'var(--color-brand)' : 'var(--bg-input)',
                        color: tab === t ? 'white' : 'var(--text-secondary)',
                        fontWeight: tab === t ? 600 : 400, fontSize: '14px',
                    }}>
                        {t === 'announcements' ? '公告管理' : t === 'feedback' ? '意見回饋' : t === 'shares' ? '共享平台' : '使用統計'}
                    </button>
                ))}
            </div>

            {/* Announcements Tab */}
            {tab === 'announcements' && (
                <>
                    {!showCreateForm && !editingId && (
                        <button onClick={() => setShowCreateForm(true)} style={{ ...btnPrimary, marginBottom: '12px' }}>
                            + 新增公告
                        </button>
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
                    {!loading && !showCreateForm && !editingId && announcements.map((ann) => (
                        <div key={ann.id} style={{ ...card, borderLeft: `4px solid ${TYPE_COLORS[ann.type] || TYPE_COLORS.info}` }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: TYPE_COLORS[ann.type] || TYPE_COLORS.info }}>
                                            {TYPE_LABELS[ann.type] || ann.type}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>v{ann.version || 1}</span>
                                    </div>
                                    <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px', margin: '0 0 4px' }}>{ann.title}</p>
                                    {ann.body && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px', whiteSpace: 'pre-line' }}>{ann.body}</p>}
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                                        {new Date(ann.published_at).toLocaleString('zh-TW')}
                                        {ann.expires_at && ` → ${new Date(ann.expires_at).toLocaleString('zh-TW')}`}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                                    <button onClick={() => { setEditingId(ann.id); setShowCreateForm(false); }} style={btnGhost}>編輯</button>
                                    <button onClick={() => handleDelete(ann.id, ann.title)} style={btnDanger}>刪除</button>
                                </div>
                            </div>
                        </div>
                    ))}
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
        </div>
    );
}
