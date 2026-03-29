/**
 * 公告彈窗 / Announcement Modal
 * App 啟動後若有未讀公告，顯示一次（每 session 只彈一次）。
 * Shown once per session when there are unread announcements.
 *
 * 使用 CSS custom properties 與 inline styles，與 Settings 頁面 modal 風格一致。
 * Uses CSS vars + inline styles consistent with Settings page modals.
 */
import { useState, useEffect, startTransition } from 'react';
import { createPortal } from 'react-dom';
import useNotifyStore from '../stores/notifyStore';
import { trackEvent } from '../services/analytics';

const SESSION_KEY = 'piyou_announce_shown';

/**
 * 僅允許 http:// 或 https:// 開頭的 URL，防止 javascript:/data: 協定注入。
 * Only allow http:// or https:// URLs to prevent javascript:/data: injection.
 */
function sanitizeUrl(url) {
    if (!url) return '#';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return '#';
}

const TYPE_CONFIG = {
    urgent: {
        bg: 'var(--color-danger)',
        label: '緊急',
    },
    warning: {
        bg: 'var(--color-warning)',
        label: '注意',
    },
    info: {
        bg: 'var(--color-brand)',
        label: '公告',
    },
};

export default function AnnouncementModal() {
    const { announcements, unreadIds, markRead, fetchAnnouncements, openedAnnId, closeOpenedAnn } = useNotifyStore();
    const [autoVisible, setAutoVisible] = useState(false);
    const [index, setIndex] = useState(0);

    // 啟動時抓公告 / Fetch announcements on mount
    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    // 公告抓回後判斷是否要自動彈 / After fetch, decide whether to auto-show
    useEffect(() => {
        if (sessionStorage.getItem(SESSION_KEY)) return;
        if (unreadIds.length > 0) {
            sessionStorage.setItem(SESSION_KEY, '1');
            startTransition(() => setAutoVisible(true));
            trackEvent('notify_popup', { count: unreadIds.length });
        }
    }, [unreadIds]);

    const secondaryBtnStyle = {
        fontSize: '14px', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
        transition: 'background 0.15s', background: 'var(--bg-input)',
        color: 'var(--text-secondary)', border: '1px solid var(--border)', fontWeight: 500,
    };

    const primaryBtnStyle = {
        fontSize: '14px', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
        transition: 'opacity 0.15s', background: 'var(--color-brand)',
        color: 'white', border: 'none', fontWeight: 500,
    };

    // ── 手動模式（從通知面板點擊）/ Manual mode (clicked from notification panel) ──
    const isManual = !!openedAnnId;
    const manualAnn = isManual ? announcements.find((a) => a.id === openedAnnId) : null;

    if (isManual && manualAnn) {
        const config = TYPE_CONFIG[manualAnn.type] || TYPE_CONFIG.info;
        return createPortal(
            <div
                style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', background: 'rgba(0,0,0,0.5)',
                }}
                className="animate-fade-in"
                onClick={closeOpenedAnn}
            >
                <div style={{ width: '100%', maxWidth: '420px', borderRadius: 'var(--radius-card, 16px)', overflow: 'hidden', background: 'var(--bg-card)', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: config.bg, color: 'white' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85 }}>{config.label}</span>
                        <button onClick={closeOpenedAnn} style={{ color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }} aria-label="關閉">✕</button>
                    </div>
                    <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>{manualAnn.title}</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{manualAnn.body}</p>
                        {manualAnn.link_url && (
                            <a href={sanitizeUrl(manualAnn.link_url)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '12px', fontSize: '14px', fontWeight: 500, color: 'var(--color-brand)', textDecoration: 'underline' }}>
                                {manualAnn.link_label || '了解更多'}
                            </a>
                        )}
                        <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(manualAnn.published_at).toLocaleDateString('zh-TW')}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '0 20px 20px', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => { markRead(manualAnn.id); closeOpenedAnn(); trackEvent('button_click', { action: 'notify_dismiss' }); }} style={secondaryBtnStyle}>不再顯示</button>
                            <button onClick={closeOpenedAnn} style={primaryBtnStyle}>我知道了</button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // ── 自動彈出模式 / Auto-popup mode ──
    if (!autoVisible || announcements.length === 0) return null;

    const unread = announcements.filter((a) => unreadIds.includes(a.id));
    if (unread.length === 0) return null;

    const current = unread[Math.min(index, unread.length - 1)];
    const total = unread.length;
    const config = TYPE_CONFIG[current?.type] || TYPE_CONFIG.info;

    // 「我知道了」只關閉 session，不永久標已讀 / "Got it" only closes, not permanently marked
    const handleGotIt = () => setAutoVisible(false);
    const handleDismiss = () => { markRead(current.id); setAutoVisible(false); trackEvent('button_click', { action: 'notify_dismiss' }); };

    const handlePrev = () => setIndex((i) => Math.max(0, i - 1));
    const handleNext = () => {
        if (index < total - 1) {
            setIndex((i) => i + 1);
        }
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
            onClick={handleGotIt}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    borderRadius: 'var(--radius-card, 16px)',
                    overflow: 'hidden',
                    background: 'var(--bg-card)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 標題列 / Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    background: config.bg,
                    color: 'white',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            opacity: 0.85,
                        }}>
                            {config.label}
                        </span>
                        {total > 1 && (
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>
                                {index + 1} / {total}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleGotIt}
                        style={{
                            color: 'rgba(255,255,255,0.7)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '18px',
                            lineHeight: 1,
                            padding: '4px',
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                        aria-label="關閉"
                    >
                        ✕
                    </button>
                </div>

                {/* 內文 / Body */}
                <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginBottom: '8px',
                    }}>
                        {current.title}
                    </h3>
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-line',
                        lineHeight: 1.6,
                    }}>
                        {current.body}
                    </p>

                    {current.link_url && (
                        <a
                            href={sanitizeUrl(current.link_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-block',
                                marginTop: '12px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: 'var(--color-brand)',
                                textDecoration: 'underline',
                            }}
                        >
                            {current.link_label || '了解更多'}
                        </a>
                    )}

                    <p style={{
                        marginTop: '12px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                    }}>
                        {new Date(current.published_at).toLocaleDateString('zh-TW')}
                    </p>
                </div>

                {/* 操作列 / Actions */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0 20px 20px',
                    gap: '8px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: total > 1 ? 'space-between' : 'flex-end',
                        gap: '8px',
                    }}>
                        {total > 1 ? (
                            <>
                                <button
                                    onClick={handlePrev}
                                    disabled={index === 0}
                                    style={{
                                        ...secondaryBtnStyle,
                                        opacity: index === 0 ? 0.3 : 1,
                                        cursor: index === 0 ? 'default' : 'pointer',
                                    }}
                                >
                                    ← 上一則
                                </button>
                                {index < total - 1 ? (
                                    <button onClick={handleNext} style={primaryBtnStyle}>
                                        下一則 →
                                    </button>
                                ) : (
                                    <button onClick={handleGotIt} style={primaryBtnStyle}>
                                        我知道了
                                    </button>
                                )}
                            </>
                        ) : (
                            <button onClick={handleGotIt} style={primaryBtnStyle}>
                                我知道了
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleDismiss}
                        style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 0',
                            textAlign: 'center',
                            opacity: 0.7,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                    >
                        不再顯示此公告
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
