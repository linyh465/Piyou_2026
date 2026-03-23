/**
 * 通知鈴鐺面板 / Notification Bell Panel
 * fixed 定位於右上角，點擊展開公告下拉列表。
 * Fixed at top-right corner; click to open announcement dropdown.
 *
 * 使用 CSS custom properties 與 inline styles 以維持 iOS-native 風格一致性
 * Uses CSS vars + inline styles to match iOS-native design consistency.
 */
import { useState, useRef, useEffect } from 'react';
import useNotifyStore from '../stores/notifyStore';
import { IconBell } from './Icons';

const TYPE_DOT_COLOR = {
    urgent: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-brand)',
};

export default function NotificationPanel({ onOpenFeedback }) {
    const {
        announcements,
        unreadIds,
        getUnreadCount,
        markAllRead,
        fetchAnnouncements,
        openAnnouncement,
    } = useNotifyStore();

    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const unreadCount = getUnreadCount();

    // 點擊面板外關閉 / Close when clicking outside
    useEffect(() => {
        if (!open) return;
        function handleClick(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const handleBellClick = () => {
        if (!open) fetchAnnouncements();
        setOpen((prev) => !prev);
    };

    const handleItemClick = (id) => {
        openAnnouncement(id);
        setOpen(false);
    };

    // 最新 10 則 / Latest 10
    const items = announcements.slice(0, 10);

    return (
        <div
            ref={panelRef}
            style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: '14px', zIndex: 150 }}
        >
            {/* 鈴鐺按鈕 / Bell button */}
            <button
                onClick={handleBellClick}
                style={{
                    position: 'relative',
                    padding: '8px',
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                    boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.08))',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                aria-label="通知"
            >
                <IconBell size={20} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        minWidth: '18px',
                        height: '18px',
                        padding: '0 4px',
                        borderRadius: '9px',
                        background: 'var(--color-danger)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* 下拉面板 / Dropdown panel */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '320px',
                    maxHeight: '384px',
                    overflowY: 'auto',
                    borderRadius: 'var(--radius-card, 16px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                }}>
                    {/* 標頭 / Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border-light)',
                    }}>
                        <span style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: 'var(--text)',
                        }}>
                            校園公告
                        </span>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{
                                    fontSize: '12px',
                                    color: 'var(--text-muted)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    transition: 'color 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                            >
                                全部已讀
                            </button>
                        )}
                    </div>

                    {/* 公告列表 / Announcement list */}
                    {items.length === 0 ? (
                        <div style={{
                            padding: '32px 16px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: 'var(--text-muted)',
                        }}>
                            目前沒有公告
                        </div>
                    ) : (
                        <div>
                            {items.map((ann) => {
                                const isUnread = unreadIds.includes(ann.id);
                                return (
                                    <button
                                        key={ann.id}
                                        onClick={() => handleItemClick(ann.id)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '12px 16px',
                                            borderBottom: '1px solid var(--border-light)',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottomStyle: 'solid',
                                            borderBottomWidth: '1px',
                                            borderBottomColor: 'var(--border-light)',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '10px',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span style={{
                                            marginTop: '6px',
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            flexShrink: 0,
                                            background: isUnread
                                                ? (TYPE_DOT_COLOR[ann.type] || 'var(--color-brand)')
                                                : 'transparent',
                                        }} />
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <p style={{
                                                fontSize: '14px',
                                                lineHeight: 1.4,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontWeight: isUnread ? 600 : 400,
                                                color: isUnread ? 'var(--text)' : 'var(--text-muted)',
                                            }}>
                                                {ann.title}
                                            </p>
                                            <p style={{
                                                fontSize: '12px',
                                                color: 'var(--text-muted)',
                                                marginTop: '2px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {ann.body?.slice(0, 40) || ''}
                                            </p>
                                            <p style={{
                                                fontSize: '10px',
                                                color: 'var(--text-muted)',
                                                marginTop: '2px',
                                                opacity: 0.6,
                                            }}>
                                                {new Date(ann.published_at).toLocaleDateString('zh-TW')}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* 底部意見回饋入口 / Bottom feedback entry */}
                    <div style={{
                        borderTop: '1px solid var(--border-light)',
                        padding: '10px 16px',
                    }}>
                        <button
                            onClick={() => {
                                setOpen(false);
                                onOpenFeedback?.();
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'center',
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '6px',
                                transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            意見回饋
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
