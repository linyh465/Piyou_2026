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

const SESSION_KEY = 'piyou_announce_shown';

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
    const { announcements, unreadIds, markRead, markAllRead, fetchAnnouncements } = useNotifyStore();
    const [visible, setVisible] = useState(false);
    const [index, setIndex] = useState(0);

    // 啟動時抓公告 / Fetch announcements on mount
    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    // 公告抓回後判斷是否要彈 / After fetch, decide whether to show
    useEffect(() => {
        if (sessionStorage.getItem(SESSION_KEY)) return;
        if (unreadIds.length > 0) {
            sessionStorage.setItem(SESSION_KEY, '1');
            startTransition(() => setVisible(true));
        }
    }, [unreadIds]);

    if (!visible || announcements.length === 0) return null;

    const unread = announcements.filter((a) => unreadIds.includes(a.id));
    if (unread.length === 0) return null;

    const current = unread[Math.min(index, unread.length - 1)];
    const total = unread.length;
    const config = TYPE_CONFIG[current?.type] || TYPE_CONFIG.info;

    const handleClose = () => {
        markAllRead();
        setVisible(false);
    };

    const handlePrev = () => setIndex((i) => Math.max(0, i - 1));
    const handleNext = () => {
        if (index < total - 1) {
            markRead(current.id);
            setIndex((i) => i + 1);
        }
    };

    const secondaryBtnStyle = {
        fontSize: '14px',
        padding: '8px 16px',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'background 0.15s',
        background: 'var(--bg-input)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
        fontWeight: 500,
    };

    const primaryBtnStyle = {
        fontSize: '14px',
        padding: '8px 16px',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'opacity 0.15s',
        background: 'var(--color-brand)',
        color: 'white',
        border: 'none',
        fontWeight: 500,
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
                        onClick={handleClose}
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
                <div style={{ padding: '20px' }}>
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
                            href={current.link_url}
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
                                    <button onClick={handleClose} style={primaryBtnStyle}>
                                        我知道了
                                    </button>
                                )}
                            </>
                        ) : (
                            <button onClick={handleClose} style={primaryBtnStyle}>
                                我知道了
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => { markRead(current.id); setVisible(false); }}
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
