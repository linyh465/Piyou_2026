/**
 * 意見回饋 Modal / Feedback Modal
 * 學生送出匿名回饋，管理員回覆後可查詢。
 * Students submit anonymous feedback; admin replies are queryable.
 *
 * 使用 CSS custom properties 與 inline styles，與 Settings 頁面風格一致。
 * Uses CSS vars + inline styles consistent with the Settings page.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import useNotifyStore from '../stores/notifyStore';
import { trackEvent } from '../services/analytics';

const CATEGORIES = [
    { value: 'bug', label: '回報問題' },
    { value: 'feature', label: '功能建議' },
    { value: 'question', label: '使用疑問' },
    { value: 'other', label: '其他' },
];

const MAX_CONTENT = 1000;

export default function FeedbackModal({ show, onClose }) {
    const { submitFeedback, getFeedbackReply } = useNotifyStore();

    // 送出表單狀態
    const [category, setCategory] = useState('bug');
    const [content, setContent] = useState('');
    const [contact, setContact] = useState('');
    const [customId, setCustomId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submittedId, setSubmittedId] = useState('');
    const [submitError, setSubmitError] = useState('');

    // 查詢回覆狀態
    const [queryId, setQueryId] = useState('');
    const [queryResult, setQueryResult] = useState(null);
    const [querying, setQuerying] = useState(false);
    const [queryError, setQueryError] = useState('');

    if (!show) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting || content.trim().length < 10) return;
        setSubmitting(true);
        setSubmitError('');
        const result = await submitFeedback({ category, content: content.trim(), contact: contact.trim(), customId: customId.trim() });
        setSubmitting(false);
        if (result.ok) {
            setSubmitted(true);
            setSubmittedId(result.id);
            trackEvent('feedback_submit', { category });
        } else {
            setSubmitError(result.error || '送出失敗，請稍後再試');
        }
    };

    const handleQuery = async () => {
        if (querying || !queryId.trim()) return;
        setQuerying(true);
        setQueryError('');
        setQueryResult(null);
        try {
            const result = await getFeedbackReply(queryId.trim());
            if (result) {
                setQueryResult(result);
            } else {
                setQueryError('找不到此回饋 ID，請確認是否正確');
            }
        } catch {
            setQueryError('查詢失敗，請稍後再試');
        }
        setQuerying(false);
    };

    const handleClose = () => {
        setCategory('bug');
        setContent('');
        setContact('');
        setCustomId('');
        setSubmitting(false);
        setSubmitted(false);
        setSubmittedId('');
        setSubmitError('');
        setQueryId('');
        setQueryResult(null);
        setQuerying(false);
        setQueryError('');
        onClose();
    };

    const inputStyle = {
        width: '100%',
        fontSize: '14px',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--bg-input)',
        color: 'var(--text)',
        outline: 'none',
        transition: 'border-color 0.2s',
    };

    return createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: 'rgba(0,0,0,0.5)',
            }}
            className="animate-fade-in"
            onClick={handleClose}
        >
            <div
                className="card"
                style={{ width: '100%', maxWidth: '420px', maxHeight: '80vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 標題列 */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--border-light)',
                    marginBottom: '16px',
                }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)' }}>
                        意見回饋
                    </h3>
                    <button
                        onClick={handleClose}
                        style={{
                            color: 'var(--text-muted)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '18px',
                            lineHeight: 1,
                            padding: '4px',
                        }}
                        aria-label="關閉"
                    >
                        ✕
                    </button>
                </div>

                {!submitted ? (
                    /* 送出表單 / Submit form */
                    <form onSubmit={handleSubmit}>
                        {/* 類別 */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                類別
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {CATEGORIES.map((c) => {
                                    const isActive = category === c.value;
                                    return (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => setCategory(c.value)}
                                            style={{
                                                fontSize: '14px',
                                                padding: '10px 12px',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                textAlign: 'left',
                                                fontWeight: 500,
                                                background: isActive ? 'var(--color-brand-subtle)' : 'var(--bg-input)',
                                                color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
                                                border: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
                                            }}
                                        >
                                            {c.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 內容 */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                內容（至少 10 字）
                            </label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
                                rows={4}
                                placeholder="請描述您的問題或建議..."
                                style={{
                                    ...inputStyle,
                                    resize: 'none',
                                }}
                            />
                            <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {content.length} / {MAX_CONTENT}
                            </div>
                        </div>

                        {/* 聯絡方式（選填） */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                聯絡方式（選填，留空即匿名）
                            </label>
                            <input
                                type="text"
                                value={contact}
                                onChange={(e) => setContact(e.target.value.slice(0, 100))}
                                placeholder="e-mail 或其他聯絡方式"
                                style={inputStyle}
                            />
                        </div>

                        {/* 自訂查詢 ID（選填） */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                自訂查詢 ID（選填）
                            </label>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.7 }}>
                                設定易記的 ID 方便日後查詢；留空則自動產生隨機 ID
                            </p>
                            <input
                                type="text"
                                value={customId}
                                onChange={(e) => setCustomId(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40))}
                                placeholder="例如：yhlin-bug-0323"
                                style={inputStyle}
                            />
                        </div>

                        {submitError && (
                            <div style={{
                                padding: '12px',
                                borderRadius: '10px',
                                marginBottom: '12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--color-danger)',
                                fontSize: '14px',
                            }}>
                                {submitError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting || content.trim().length < 10}
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: '15px',
                                opacity: (submitting || content.trim().length < 10) ? 0.5 : 1,
                            }}
                        >
                            {submitting ? '送出中…' : '送出回饋'}
                        </button>
                    </form>
                ) : (
                    /* 送出成功 / Submit success */
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-success)', marginBottom: '8px' }}>
                            回饋已送出，謝謝！
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            您的回饋 ID（可用於查詢管理員回覆）：
                        </p>
                        <code style={{
                            display: 'block',
                            fontSize: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            wordBreak: 'break-all',
                            color: 'var(--text-secondary)',
                            userSelect: 'all',
                            fontFamily: 'monospace',
                        }}>
                            {submittedId}
                        </code>
                    </div>
                )}

                {/* 查詢回覆區 / Reply query section */}
                <div style={{
                    borderTop: '1px solid var(--border-light)',
                    marginTop: '20px',
                    paddingTop: '16px',
                }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '10px' }}>
                        查詢管理員回覆
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={queryId}
                            onChange={(e) => setQueryId(e.target.value)}
                            placeholder="貼上回饋 ID"
                            style={{ ...inputStyle, flex: 1, fontSize: '12px' }}
                        />
                        <button
                            onClick={handleQuery}
                            disabled={querying || !queryId.trim()}
                            className="btn btn-ghost"
                            style={{
                                fontSize: '12px',
                                padding: '8px 14px',
                                whiteSpace: 'nowrap',
                                opacity: (querying || !queryId.trim()) ? 0.4 : 1,
                            }}
                        >
                            {querying ? '查詢中…' : '查詢'}
                        </button>
                    </div>

                    {queryError && (
                        <div style={{
                            padding: '10px',
                            borderRadius: '10px',
                            marginTop: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--color-danger)',
                            fontSize: '12px',
                        }}>
                            {queryError}
                        </div>
                    )}

                    {queryResult && (
                        <div style={{
                            borderRadius: '10px',
                            background: 'var(--bg-input)',
                            padding: '12px',
                            marginTop: '10px',
                        }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                狀態：
                                <span style={{
                                    fontWeight: 500,
                                    color: queryResult.status === 'replied' ? 'var(--color-success)' : 'var(--text-secondary)',
                                }}>
                                    {queryResult.status === 'replied' ? '已回覆' : '待處理'}
                                </span>
                            </p>
                            {queryResult.admin_reply && (
                                <>
                                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '8px' }}>
                                        管理員回覆：
                                    </p>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'pre-line', marginTop: '4px' }}>
                                        {queryResult.admin_reply}
                                    </p>
                                    {queryResult.replied_at && (
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', opacity: 0.6 }}>
                                            {new Date(queryResult.replied_at).toLocaleDateString('zh-TW')}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
