/**
 * 共享平台 / Share Platform
 * 以自訂分享碼分享文字與連結；訂閱他人分享碼即可在此頁看到內容。
 * Share text & links via custom codes; subscribe by entering a code.
 */
import { useState, useEffect, useCallback } from 'react';
import { IconLink2, IconPlus, IconTrash, IconRefresh, IconXCircle, IconCheck } from '../components/Icons';

function getDeviceId() {
    let id = localStorage.getItem('piyou_device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('piyou_device_id', id);
    }
    return id;
}

const API = import.meta.env.VITE_API_URL || '';
const LS_KEY = 'piyou_shares'; // [{code, title, body, link_url, created_at, deleted, is_owner}]

// ── localStorage helpers ──

function loadShares() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function saveShares(shares) {
    localStorage.setItem(LS_KEY, JSON.stringify(shares));
}

function upsertShare(entry) {
    const list = loadShares();
    const idx = list.findIndex((s) => s.code === entry.code);
    if (idx >= 0) list[idx] = { ...list[idx], ...entry };
    else list.unshift(entry);
    saveShares(list);
}

function removeShare(code) {
    saveShares(loadShares().filter((s) => s.code !== code));
}

// ── API calls ──

async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}/api/v1/share${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── Sub-components ──

function ShareCard({ entry, deviceId, onRemove }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await apiFetch(`/${entry.code}`, {
                method: 'DELETE',
                body: JSON.stringify({ device_id: deviceId }),
            });
            // 標記本地為已刪除（owner 刪除後直接移除）
            removeShare(entry.code);
            onRemove(entry.code);
        } catch (e) {
            alert(`刪除失敗：${e.message}`);
        } finally {
            setDeleting(false);
        }
    };

    const handleDismiss = () => {
        removeShare(entry.code);
        onRemove(entry.code);
    };

    return (
        <div style={{
            background: 'var(--bg-card)', borderRadius: '14px', padding: '16px 18px',
            border: '1px solid var(--border-subtle)', position: 'relative',
        }}>
            {/* 分享碼標籤 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{
                    fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em',
                    color: 'var(--color-brand)', background: 'var(--color-brand-subtle)',
                    padding: '2px 8px', borderRadius: '99px',
                }}>
                    #{entry.code}
                </span>
                {entry.is_owner && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>你的分享</span>
                )}
            </div>

            {entry.deleted ? (
                /* 已刪除狀態 */
                <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>
                    ⚠️ 擁有者已刪除此分享
                </div>
            ) : (
                <>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px', color: 'var(--text-primary)' }}>
                        {entry.title}
                    </div>
                    {entry.body && (
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginBottom: '8px', lineHeight: '1.6' }}>
                            {entry.body}
                        </div>
                    )}
                    {entry.link_url && (
                        <a
                            href={entry.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '13px', color: 'var(--color-brand)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                            <IconLink2 size={14} /> {entry.link_url}
                        </a>
                    )}
                </>
            )}

            {/* 操作按鈕 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '8px' }}>
                {entry.deleted ? (
                    <button className="btn-ghost btn-sm" onClick={handleDismiss} style={{ color: 'var(--color-danger)', fontSize: '13px' }}>
                        移除此則
                    </button>
                ) : entry.is_owner ? (
                    <button className="btn-ghost btn-sm" onClick={handleDelete} disabled={deleting}
                        style={{ color: 'var(--color-danger)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconTrash size={14} /> {deleting ? '刪除中…' : '刪除'}
                    </button>
                ) : (
                    <button className="btn-ghost btn-sm" onClick={handleDismiss}
                        style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        移除訂閱
                    </button>
                )}
            </div>
        </div>
    );
}

// ── 訂閱分享碼 modal ──

function SubscribeForm({ onSubscribed }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed) return;
        setLoading(true);
        setError('');
        try {
            const data = await apiFetch(`/${trimmed}`);
            upsertShare({ ...data, is_owner: false });
            onSubscribed(data);
            setCode('');
        } catch (e) {
            setError(e.message.includes('404') ? '找不到此分享碼' : e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="輸入分享碼…"
                    style={{
                        flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
                        border: '1.5px solid var(--border-subtle)', background: 'var(--bg-input)',
                        color: 'var(--text-primary)', outline: 'none',
                    }}
                    maxLength={30}
                />
                <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    style={{
                        padding: '10px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                        background: 'var(--color-brand)', color: '#fff', border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {loading ? '搜尋中…' : '訂閱'}
                </button>
            </form>
            {error && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '6px' }}>{error}</div>}
        </div>
    );
}

// ── 建立分享表單 ──

function CreateForm({ deviceId, onCreated }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ code: '', title: '', body: '', link_url: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await apiFetch('', {
                method: 'POST',
                body: JSON.stringify({
                    code: form.code.trim(),
                    title: form.title.trim(),
                    body: form.body.trim() || null,
                    link_url: form.link_url.trim() || null,
                    device_id: deviceId,
                }),
            });
            upsertShare({ ...data, is_owner: true });
            onCreated(data);
            setForm({ code: '', title: '', body: '', link_url: '' });
            setSuccess(true);
            setTimeout(() => { setSuccess(false); setOpen(false); }, 1500);
        } catch (e) {
            setError(e.message.includes('409') ? '此分享碼已被使用，請換一個' : e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                    background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer',
                }}
            >
                <IconPlus size={16} /> 建立分享
            </button>
        );
    }

    const inputStyle = {
        width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
        border: '1.5px solid var(--border-subtle)', background: 'var(--bg-input)',
        color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
    };
    const labelStyle = { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' };

    return (
        <form onSubmit={handleSubmit} style={{
            background: 'var(--bg-card)', borderRadius: '14px', padding: '18px',
            border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '15px' }}>建立新分享</span>
                <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <IconXCircle size={20} />
                </button>
            </div>

            <div>
                <label style={labelStyle}>自訂分享碼（3–30 字，英數字 / - / _）</label>
                <input value={form.code} onChange={set('code')} style={inputStyle}
                    placeholder="例：mygroup-2026" maxLength={30} required
                    pattern="[A-Za-z0-9_\-]{3,30}" />
            </div>
            <div>
                <label style={labelStyle}>標題（必填）</label>
                <input value={form.title} onChange={set('title')} style={inputStyle}
                    placeholder="分享標題…" maxLength={60} required />
            </div>
            <div>
                <label style={labelStyle}>內文（選填）</label>
                <textarea value={form.body} onChange={set('body')} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                    placeholder="分享內容…" maxLength={2000} />
            </div>
            <div>
                <label style={labelStyle}>連結（選填）</label>
                <input value={form.link_url} onChange={set('link_url')} style={inputStyle}
                    placeholder="https://…" maxLength={500} type="url" />
            </div>

            {error && <div style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{error}</div>}

            <button type="submit" disabled={loading || success} style={{
                padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                background: success ? 'var(--color-success)' : 'var(--color-brand)',
                color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'background 0.3s',
            }}>
                {success ? <><IconCheck size={16} /> 建立成功！</> : loading ? '建立中…' : '發布'}
            </button>
        </form>
    );
}

// ── 主頁面 ──

export default function Share() {
    const deviceId = getDeviceId();
    const [shares, setShares] = useState(loadShares);
    const [refreshing, setRefreshing] = useState(false);

    const refreshAll = useCallback(async () => {
        const list = loadShares();
        if (!list.length) { setRefreshing(false); return; }
        setRefreshing(true);
        const updated = await Promise.all(
            list.map(async (s) => {
                try {
                    const fresh = await apiFetch(`/${s.code}`);
                    return { ...s, ...fresh };
                } catch {
                    return s; // 保持舊狀態
                }
            })
        );
        updated.forEach(upsertShare);
        setRefreshing(false);
        setShares(loadShares());
    }, []);

    useEffect(() => {
        let active = true;
        refreshAll().then(() => { if (!active) setRefreshing(false); });
        return () => { active = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubscribed = () => {
        setShares(loadShares());
    };

    const handleCreated = () => {
        setShares(loadShares());
    };

    const handleRemove = (code) => {
        setShares((prev) => prev.filter((s) => s.code !== code));
    };

    return (
        <div style={{ padding: '20px 16px', maxWidth: '600px', margin: '0 auto' }}>

            {/* 頁首 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <IconLink2 size={22} style={{ color: 'var(--color-brand)' }} />
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>共享平台</h1>
                <button
                    onClick={refreshAll}
                    disabled={refreshing}
                    style={{
                        marginLeft: 'auto', background: 'none', border: 'none',
                        cursor: refreshing ? 'not-allowed' : 'pointer',
                        color: 'var(--text-muted)', padding: '4px',
                    }}
                    title="重新整理"
                >
                    <IconRefresh size={18} style={{ opacity: refreshing ? 0.4 : 1 }} />
                </button>
            </div>

            {/* 訂閱分享碼 */}
            <div style={{
                background: 'var(--bg-card)', borderRadius: '14px', padding: '16px 18px',
                border: '1px solid var(--border-subtle)', marginBottom: '16px',
            }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    輸入分享碼，即可訂閱並查看對方分享的內容
                </div>
                <SubscribeForm onSubscribed={handleSubscribed} />
            </div>

            {/* 建立分享 */}
            <div style={{ marginBottom: '20px' }}>
                <CreateForm deviceId={deviceId} onCreated={handleCreated} />
            </div>

            {/* 分享列表 */}
            {shares.length === 0 ? (
                <div style={{
                    textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px',
                    padding: '40px 0',
                }}>
                    尚無訂閱的分享<br />
                    <span style={{ fontSize: '12px' }}>輸入分享碼或建立自己的分享開始吧</span>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {shares.map((entry) => (
                        <ShareCard
                            key={entry.code}
                            entry={entry}
                            deviceId={deviceId}
                            onRemove={handleRemove}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
