/**
 * 共享平台 / Share Platform
 * 以自訂分享碼分享文字與連結；訂閱他人分享碼即可在此頁看到內容。
 * Share text & links via custom codes; subscribe by entering a code.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    IconLink2, IconPlus, IconTrash, IconRefresh, IconXCircle,
    IconCheck, IconMinus, IconEdit, IconLock, IconEye, IconEyeOff,
} from '../components/Icons';
import { trackEvent } from '../services/analytics';
import { markShareRemoved, scheduleUpload, uploadUserSync, downloadAndMergeUserSync } from '../services/userSyncService';

// ── 響應式斷點 / Responsive breakpoint hook ──

function useIsDesktop(breakpoint = 768) {
    const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= breakpoint);
    useEffect(() => {
        const handler = () => setIsDesktop(window.innerWidth >= breakpoint);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, [breakpoint]);
    return isDesktop;
}

function getDeviceId() {
    let id = localStorage.getItem('piyou_device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('piyou_device_id', id);
    }
    return id;
}

const API = import.meta.env.VITE_API_URL || '';
const LS_KEY = 'piyou_shares'; // [{code, title, body, link_urls, created_at, deleted, is_owner, password_protected}]

// ── localStorage helpers ──

function loadShares() {
    try {
        const data = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        return Array.isArray(data) ? data.filter((s) => s && typeof s.code === 'string' && s.code) : [];
    } catch { return []; }
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

// When a share is renamed (new_code), remove old entry and add new
function renameShare(oldCode, newEntry) {
    const list = loadShares().filter((s) => s.code !== oldCode);
    list.unshift(newEntry);
    saveShares(list);
}

// ── API calls ──

function deviceHeaders() {
    const headers = {
        'Content-Type': 'application/json',
        'X-Device-Id': getDeviceId(),
    };
    const token = sessionStorage.getItem('piyou_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}/api/v1/share${path}`, {
        headers: deviceHeaders(),
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.detail || `HTTP ${res.status}`);
        error.status = res.status;
        throw error;
    }
    return res.json();
}

// ── 共用樣式 ──

const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
    border: '1.5px solid var(--border-subtle)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
};
const labelStyle = {
    fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block',
};

// ── 連結欄位列表（可重用）──

function LinkUrlsEditor({ linkUrls, setLinkUrls }) {
    const setLinkUrl = (i, val) => setLinkUrls((prev) => prev.map((u, idx) => idx === i ? val : u));
    const addLinkUrl = () => { if (linkUrls.length < 10) setLinkUrls((prev) => [...prev, '']); };
    const removeLinkUrl = (i) => setLinkUrls((prev) => prev.filter((_, idx) => idx !== i));

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>連結（選填，最多 10 個）</label>
                {linkUrls.length < 10 && (
                    <button type="button" onClick={addLinkUrl}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-brand)', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '13px' }}>
                        <IconPlus size={14} /> 新增
                    </button>
                )}
            </div>
            {linkUrls.map((url, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input value={url} onChange={(e) => setLinkUrl(i, e.target.value)}
                        style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                        placeholder="https://…" maxLength={500} type="url" />
                    {linkUrls.length > 1 && (
                        <button type="button" onClick={() => removeLinkUrl(i)}
                            style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 8px' }}>
                            <IconMinus size={14} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

// ── ShareCard ──

function ShareCard({ entry, deviceId, onRemove, onUpdated }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // 密碼解鎖
    const [unlockPw, setUnlockPw] = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState('');

    // 編輯模式
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({
        code: entry.code,
        title: entry.title,
        body: entry.body || '',
    });
    const [editLinkUrls, setEditLinkUrls] = useState(entry.link_urls?.length ? entry.link_urls : ['']);
    const [editPwMode, setEditPwMode] = useState('keep'); // 'keep' | 'set' | 'remove'
    const [editPw, setEditPw] = useState('');
    const [editPwConfirm, setEditPwConfirm] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const isLocked = entry.password_protected && !entry.is_owner && !entry.unlocked;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await apiFetch(`/${entry.code}`, {
                method: 'DELETE',
                body: JSON.stringify({ device_id: deviceId }),
            });
            markShareRemoved(entry.code);
            removeShare(entry.code);
            onRemove(entry.code);
            scheduleUpload();
        } catch (e) {
            alert(`刪除失敗：${e.message}`);
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const handleUnlock = async (e) => {
        e.preventDefault();
        if (!unlockPw.trim()) return;
        setUnlocking(true);
        setUnlockError('');
        try {
            const data = await apiFetch(`/${entry.code}/view`, {
                method: 'POST',
                body: JSON.stringify({ password: unlockPw }),
            });
            upsertShare({ ...entry, ...data, unlocked: true });
            onUpdated({ ...entry, ...data, unlocked: true });
        } catch (e) {
            setUnlockError(e.status === 403 ? '密碼錯誤，請再試一次' : (e.message || '解鎖失敗，請稍後再試'));
        } finally {
            setUnlocking(false);
        }
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (editPwMode === 'set' && editPw !== editPwConfirm) {
            setSaveError('兩次輸入的密碼不一致');
            return;
        }
        setSaving(true);
        setSaveError('');
        const validUrls = editLinkUrls.map((u) => u.trim()).filter(Boolean);
        const payload = {
            device_id: deviceId,
            title: editForm.title.trim() || undefined,
            body: editForm.body.trim() || null,
            link_urls: validUrls,
            new_code: editForm.code.trim() !== entry.code ? editForm.code.trim() : undefined,
            password: editPwMode === 'set' ? editPw : undefined,
            remove_password: editPwMode === 'remove',
        };
        try {
            const data = await apiFetch(`/${entry.code}`, {
                method: 'PATCH',
                body: JSON.stringify(payload),
            });
            const newCode = data.code;
            if (newCode !== entry.code) {
                renameShare(entry.code, { ...data, is_owner: true, unlocked: true });
            } else {
                upsertShare({ ...data, is_owner: true, unlocked: true });
            }
            onUpdated({ ...data, is_owner: true, unlocked: true, _oldCode: entry.code });
            setEditMode(false);
            scheduleUpload();
        } catch (e) {
            setSaveError(e.status === 409 ? '此分享碼已有人使用，請更換後重試' : (e.message || '儲存失敗，請稍後再試'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            background: 'var(--bg-card)', borderRadius: '14px', padding: '16px 18px',
            border: `1px solid ${entry.deleted ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
            position: 'relative', overflow: 'hidden',
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
                {entry.password_protected && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <IconLock size={11} /> 有密碼
                    </span>
                )}
            </div>

            {entry.deleted ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>
                    擁有者已刪除此分享
                </div>
            ) : editMode ? (
                /* ── 編輯模式 ── */
                <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <label style={labelStyle}>分享碼</label>
                        <input value={editForm.code}
                            onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30) }))}
                            style={inputStyle} placeholder="share-code" required maxLength={30} />
                    </div>
                    <div>
                        <label style={labelStyle}>標題</label>
                        <input value={editForm.title}
                            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value.slice(0, 60) }))}
                            style={inputStyle} required maxLength={60} />
                    </div>
                    <div>
                        <label style={labelStyle}>內文（選填）</label>
                        <textarea value={editForm.body}
                            onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value.slice(0, 2000) }))}
                            style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }} maxLength={2000} />
                    </div>
                    <LinkUrlsEditor linkUrls={editLinkUrls} setLinkUrls={setEditLinkUrls} />
                    <div>
                        <label style={labelStyle}>密碼保護</label>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                            {['keep', 'set', 'remove'].map((m) => (
                                <button key={m} type="button"
                                    onClick={() => setEditPwMode(m)}
                                    style={{
                                        fontSize: '12px', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
                                        border: `1px solid ${editPwMode === m ? 'var(--color-brand)' : 'var(--border)'}`,
                                        background: editPwMode === m ? 'var(--color-brand-subtle)' : 'var(--bg-input)',
                                        color: editPwMode === m ? 'var(--color-brand)' : 'var(--text-muted)',
                                    }}>
                                    {m === 'keep' ? '維持現狀' : m === 'set' ? '設定/更換密碼' : '移除密碼'}
                                </button>
                            ))}
                        </div>
                        {editPwMode === 'set' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <input type="password" value={editPw} onChange={(e) => setEditPw(e.target.value.slice(0, 100))}
                                    style={inputStyle} placeholder="新密碼" maxLength={100} />
                                <input type="password" value={editPwConfirm} onChange={(e) => setEditPwConfirm(e.target.value.slice(0, 100))}
                                    style={inputStyle} placeholder="再次輸入密碼" maxLength={100} />
                            </div>
                        )}
                    </div>
                    {saveError && <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>{saveError}</div>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" disabled={saving}
                            className="btn btn-primary"
                            style={{ flex: 2, fontSize: '13px', opacity: saving ? 0.5 : 1 }}>
                            {saving ? '儲存中…' : '儲存變更'}
                        </button>
                        <button type="button" onClick={() => { setEditMode(false); setSaveError(''); }}
                            className="btn btn-ghost"
                            style={{ flex: 1, fontSize: '13px' }}>
                            取消
                        </button>
                    </div>
                </form>
            ) : isLocked ? (
                /* ── 密碼鎖定狀態 ── */
                <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {entry.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>
                        <IconLock size={14} /> 此分享受密碼保護
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input type="password" value={unlockPw} onChange={(e) => setUnlockPw(e.target.value)}
                            placeholder="輸入密碼以解鎖"
                            style={{ ...inputStyle, flex: 1, fontSize: '13px', padding: '8px 12px' }}
                            maxLength={100} />
                        <button type="submit" disabled={unlocking || !unlockPw.trim()}
                            className="btn btn-primary"
                            style={{ fontSize: '13px', padding: '8px 14px', opacity: unlocking ? 0.5 : 1 }}>
                            {unlocking ? '…' : '解鎖'}
                        </button>
                    </div>
                    {unlockError && <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>{unlockError}</div>}
                </form>
            ) : (
                /* ── 一般顯示 ── */
                <>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px', color: 'var(--text-primary)' }}>
                        {entry.title}
                    </div>
                    {entry.body && (
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '8px', lineHeight: '1.6' }}>
                            {entry.body}
                        </div>
                    )}
                    {entry.link_urls?.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {entry.link_urls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: '13px', color: 'var(--color-brand)', display: 'inline-flex', alignItems: 'flex-start', gap: '4px', wordBreak: 'break-all' }}>
                                    <IconLink2 size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {url}
                                </a>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* 操作按鈕 */}
            {!editMode && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '6px', flexWrap: 'wrap' }}>
                    {entry.deleted ? (
                        <button className="btn btn-ghost"
                            onClick={() => { markShareRemoved(entry.code); removeShare(entry.code); onRemove(entry.code); scheduleUpload(); }}
                            style={{ color: 'var(--color-danger)', fontSize: '13px' }}>
                            移除此則
                        </button>
                    ) : entry.is_owner ? (
                        <>
                            <button className="btn btn-ghost"
                                onClick={() => {
                                    setEditForm({ code: entry.code, title: entry.title, body: entry.body || '' });
                                    setEditLinkUrls(entry.link_urls?.length ? [...entry.link_urls] : ['']);
                                    setEditPwMode('keep');
                                    setEditPw('');
                                    setEditPwConfirm('');
                                    setSaveError('');
                                    setEditMode(true);
                                }}
                                style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <IconEdit size={14} /> 編輯
                            </button>
                            {confirmDelete ? (
                                <>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>確定刪除？</span>
                                    <button className="btn btn-ghost" onClick={handleDelete} disabled={deleting}
                                        style={{ color: 'var(--color-danger)', fontSize: '13px' }}>
                                        {deleting ? '刪除中…' : '確定'}
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}
                                        style={{ fontSize: '13px' }}>
                                        取消
                                    </button>
                                </>
                            ) : (
                                <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}
                                    style={{ color: 'var(--color-danger)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <IconTrash size={14} /> 刪除
                                </button>
                            )}
                        </>
                    ) : (
                        <button className="btn btn-ghost"
                            onClick={() => { markShareRemoved(entry.code); removeShare(entry.code); onRemove(entry.code); scheduleUpload(); }}
                            style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                            移除訂閱
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── 訂閱分享碼表單 ──

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
            upsertShare(data);  // is_owner is computed server-side from X-Device-Id
            onSubscribed(data);
            trackEvent('share_subscribe', {}, '/share');
            scheduleUpload();
            setCode('');
        } catch (e) {
            setError(e.message || '訂閱失敗，請稍後再試');
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
                        flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
                        border: '1.5px solid var(--border-subtle)', background: 'var(--bg-input)',
                        color: 'var(--text-primary)', outline: 'none',
                    }}
                    maxLength={30}
                />
                <button type="submit" disabled={loading || !code.trim()}
                    style={{
                        padding: '10px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                        background: 'var(--color-brand)', color: '#fff', border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                    }}>
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
    const [form, setForm] = useState({ code: '', title: '', body: '' });
    const [linkUrls, setLinkUrls] = useState(['']);
    const [enablePw, setEnablePw] = useState(false);
    const [password, setPassword] = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const setF = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (enablePw && password !== pwConfirm) {
            setError('兩次輸入的密碼不一致');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const validUrls = linkUrls.map((u) => u.trim()).filter(Boolean);
            const data = await apiFetch('', {
                method: 'POST',
                body: JSON.stringify({
                    code: form.code.trim(),
                    title: form.title.trim(),
                    body: form.body.trim() || null,
                    link_urls: validUrls,
                    device_id: deviceId,
                    password: enablePw ? password : null,
                }),
            });
            upsertShare({ ...data, is_owner: true, unlocked: true });
            onCreated(data);
            trackEvent('share_create', {}, '/share');
            scheduleUpload();
            setForm({ code: '', title: '', body: '' });
            setLinkUrls(['']);
            setEnablePw(false);
            setPassword('');
            setPwConfirm('');
            setSuccess(true);
            setTimeout(() => { setSuccess(false); setOpen(false); }, 1500);
        } catch (e) {
            if (e.status === 409) {
                setError('此分享碼已有人使用，請更換後重試');
            } else {
                setError(e.message || '建立失敗，請稍後再試');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                    background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer',
                }}>
                <IconPlus size={16} /> 建立分享
            </button>
        );
    }

    return (
        <form onSubmit={handleSubmit} style={{
            background: 'var(--bg-card)', borderRadius: '14px', padding: '18px',
            border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '14px',
            width: '100%', boxSizing: 'border-box',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '15px' }}>建立新分享</span>
                <button type="button" onClick={() => setOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <IconXCircle size={20} />
                </button>
            </div>

            {/* 隱私警示 */}
            <div style={{
                background: 'rgba(239,68,68,0.07)', borderRadius: '10px', padding: '10px 14px',
                border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7',
            }}>
                <strong style={{ color: 'var(--color-danger)' }}>隱私聲明：</strong>
                請勿分享個人隱私資料（如學號、密碼、身分證號等）。本平台不對因分享而造成的資料外洩負責，分享內容由使用者自行承擔責任。
            </div>

            <div>
                <label style={labelStyle}>自訂分享碼（3–30 字，英數字 / - / _）</label>
                <input value={form.code} onChange={setF('code')} style={inputStyle}
                    placeholder="例：mygroup-2026" maxLength={30} required
                    pattern="[A-Za-z0-9_\-]{3,30}" />
            </div>
            <div>
                <label style={labelStyle}>標題（必填）</label>
                <input value={form.title} onChange={setF('title')} style={inputStyle}
                    placeholder="分享標題…" maxLength={60} required />
            </div>
            <div>
                <label style={labelStyle}>內文（選填）</label>
                <textarea value={form.body} onChange={setF('body')}
                    style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                    placeholder="分享內容…" maxLength={2000} />
            </div>
            <LinkUrlsEditor linkUrls={linkUrls} setLinkUrls={setLinkUrls} />

            {/* 密碼保護 */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={enablePw} onChange={(e) => setEnablePw(e.target.checked)} />
                        啟用訂閱密碼
                    </label>
                </div>
                {enablePw && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ position: 'relative' }}>
                            <input type={showPw ? 'text' : 'password'} value={password}
                                onChange={(e) => setPassword(e.target.value.slice(0, 100))}
                                style={{ ...inputStyle, paddingRight: '40px' }}
                                placeholder="設定密碼" maxLength={100} required={enablePw} />
                            <button type="button"
                                onClick={() => setShowPw((v) => !v)}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                            </button>
                        </div>
                        <input type={showPw ? 'text' : 'password'} value={pwConfirm}
                            onChange={(e) => setPwConfirm(e.target.value.slice(0, 100))}
                            style={inputStyle} placeholder="再次輸入密碼" maxLength={100} required={enablePw} />
                    </div>
                )}
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
    const isDesktop = useIsDesktop();
    // Track scroll container ref so sticky sidebar works correctly
    const containerRef = useRef(null);

    const refreshAll = useCallback(async () => {
        setRefreshing(true);
        try {
            // 跨裝置同步（若開啟）/ Cross-device sync (if enabled)
            const crossSync = (() => { try { return JSON.parse(localStorage.getItem('piyou_crossDeviceSync') ?? 'true'); } catch { return true; } })();
            if (crossSync) {
                await downloadAndMergeUserSync().catch(() => {});
            }

            const list = loadShares();
            if (list.length) {
                const updated = await Promise.all(
                    list.map(async (s) => {
                        try {
                            const fresh = await apiFetch(`/${s.code}`);
                            // 如果本地已解鎖，保留解鎖內容，只更新 title/deleted/password_protected
                            if (s.unlocked && fresh.password_protected) {
                                return { ...s, title: fresh.title, deleted: fresh.deleted, password_protected: fresh.password_protected };
                            }
                            return { ...s, ...fresh };
                        } catch {
                            return s;
                        }
                    })
                );
                updated.forEach(upsertShare);
            }

            if (crossSync) {
                await uploadUserSync(true).catch(() => {});
            }

            setShares(loadShares());
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        refreshAll();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubscribed = () => setShares(loadShares());
    const handleCreated = () => setShares(loadShares());
    const handleRemove = (code) => setShares((prev) => prev.filter((s) => s.code !== code));
    const handleUpdated = (entry) => {
        if (entry._oldCode && entry._oldCode !== entry.code) {
            setShares(loadShares());
        } else {
            setShares((prev) => prev.map((s) => s.code === entry.code ? { ...s, ...entry } : s));
        }
    };

    // ── 左側欄（訂閱 + 建立）/ Left panel (subscribe + create) ──
    const leftPanel = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 資安免責聲明 */}
            <div style={{
                background: 'rgba(234,179,8,0.08)', borderRadius: '12px', padding: '12px 16px',
                border: '1px solid rgba(234,179,8,0.25)', fontSize: '12px',
                color: 'var(--text-secondary)', lineHeight: '1.7',
            }}>
                <strong style={{ color: 'var(--color-warning)', display: 'block', marginBottom: '4px' }}>資安提醒</strong>
                點擊他人分享的連結前請先確認來源可信，勿輕易輸入個人資料或帳號密碼。本平台不對第三方連結的安全性負責，分享內容由使用者自行負責。若發現違規內容，請向管理員檢舉。
            </div>

            {/* 訂閱分享碼 */}
            <div style={{
                background: 'var(--bg-card)', borderRadius: '14px', padding: '16px 18px',
                border: '1px solid var(--border-subtle)',
            }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>訂閱分享碼</p>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    輸入分享碼，即可訂閱並查看對方分享的內容
                </div>
                <SubscribeForm onSubscribed={handleSubscribed} />
            </div>

            {/* 建立分享 */}
            <CreateForm deviceId={deviceId} onCreated={handleCreated} />
        </div>
    );

    // ── 右側欄（分享列表）/ Right panel (share cards) ──
    const rightPanel = (
        shares.length === 0 ? (
            <div style={{
                textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px',
                padding: isDesktop ? '60px 0' : '40px 0',
            }}>
                尚無訂閱的分享<br />
                <span style={{ fontSize: '12px' }}>輸入分享碼或建立自己的分享開始吧</span>
            </div>
        ) : (
            <div style={{
                display: 'grid',
                gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr',
                gap: '12px',
                alignItems: 'start',
            }}>
                {shares.map((entry) => (
                    <ShareCard
                        key={entry.code}
                        entry={entry}
                        deviceId={deviceId}
                        onRemove={handleRemove}
                        onUpdated={handleUpdated}
                    />
                ))}
            </div>
        )
    );

    return (
        <div ref={containerRef} className="animate-fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
            {/* 頁首 / Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '20px',
            }}>
                <IconLink2 size={22} style={{ color: 'var(--color-brand)' }} />
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>共享平台</h1>
                {isDesktop && (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '4px' }}>Share Platform</span>
                )}
                <button onClick={refreshAll} disabled={refreshing}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: refreshing ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                    title="重新整理">
                    <IconRefresh size={18} style={{ opacity: refreshing ? 0.4 : 1 }} />
                </button>
            </div>

            {isDesktop ? (
                /* ── 桌機版：左右兩欄 / Desktop: two-column layout ── */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '320px 1fr',
                    gap: '24px',
                    alignItems: 'start',
                }}>
                    {/* 左欄：sticky 側邊欄 */}
                    <div style={{ position: 'sticky', top: '16px' }}>
                        {leftPanel}
                    </div>
                    {/* 右欄：分享卡片 */}
                    <div>
                        {shares.length > 0 && (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                                共 {shares.length} 則分享
                            </p>
                        )}
                        {rightPanel}
                    </div>
                </div>
            ) : (
                /* ── 手機版：單欄 / Mobile: single-column layout ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {leftPanel}
                    {shares.length > 0 && (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                            共 {shares.length} 則分享
                        </p>
                    )}
                    {rightPanel}
                </div>
            )}
        </div>
    );
}
