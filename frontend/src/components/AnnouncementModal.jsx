/**
 * 公告彈窗 / Announcement Modal
 * App 啟動後若有未讀公告，顯示一次（每 session 只彈一次）。
 * Shown once per session when there are unread announcements.
 *
 * 掛載於 main.jsx（router tree 外）/ Mounted in main.jsx (outside router tree)
 */
import { useState, useEffect, startTransition } from 'react';
import useNotifyStore from '../stores/notifyStore';

const SESSION_KEY = 'piyou_announce_shown';

const TYPE_STYLES = {
    urgent: {
        header: 'bg-red-500 dark:bg-red-600',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        label: '緊急',
    },
    warning: {
        header: 'bg-amber-500 dark:bg-amber-600',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        label: '注意',
    },
    info: {
        header: 'var(--color-primary, #4f46e5)',  // fallback handled via style
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
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
        if (sessionStorage.getItem(SESSION_KEY)) return; // 本 session 已彈過
        if (unreadIds.length > 0) {
            sessionStorage.setItem(SESSION_KEY, '1');
            startTransition(() => setVisible(true));
        }
    }, [unreadIds]);

    if (!visible || announcements.length === 0) return null;

    // 只展示未讀的公告 / Only show unread announcements
    const unread = announcements.filter((a) => unreadIds.includes(a.id));
    if (unread.length === 0) return null;

    const current = unread[Math.min(index, unread.length - 1)];
    const total = unread.length;
    const style = TYPE_STYLES[current?.type] || TYPE_STYLES.info;

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

    const isInfo = current?.type === 'info';

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={handleClose}
        >
            <div
                className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-gray-800"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 標題列 / Header */}
                <div
                    className={`flex items-center justify-between px-5 py-4 ${isInfo ? '' : style.header} text-white`}
                    style={isInfo ? { background: 'var(--color-primary, #4f46e5)' } : undefined}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                            {style.label}
                        </span>
                        {total > 1 && (
                            <span className="text-xs opacity-70">
                                {index + 1} / {total}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-white/70 hover:text-white transition-colors text-xl leading-none"
                        aria-label="關閉"
                    >
                        ✕
                    </button>
                </div>

                {/* 內文 / Body */}
                <div className="px-5 py-5">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {current.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                        {current.body}
                    </p>

                    {current.link_url && (
                        <a
                            href={current.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-block text-sm font-medium underline"
                            style={{ color: 'var(--color-primary, #4f46e5)' }}
                        >
                            {current.link_label || '了解更多'}
                        </a>
                    )}

                    <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                        {new Date(current.published_at).toLocaleDateString('zh-TW')}
                    </p>
                </div>

                {/* 操作列 / Actions */}
                <div className="flex items-center justify-between px-5 pb-5 gap-2">
                    {total > 1 ? (
                        <>
                            <button
                                onClick={handlePrev}
                                disabled={index === 0}
                                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                ← 上一則
                            </button>
                            {index < total - 1 ? (
                                <button
                                    onClick={handleNext}
                                    className="text-sm px-3 py-1.5 rounded-lg text-white transition-colors"
                                    style={{ background: 'var(--color-primary, #4f46e5)' }}
                                >
                                    下一則 →
                                </button>
                            ) : (
                                <button
                                    onClick={handleClose}
                                    className="text-sm px-3 py-1.5 rounded-lg text-white transition-colors"
                                    style={{ background: 'var(--color-primary, #4f46e5)' }}
                                >
                                    我知道了
                                </button>
                            )}
                        </>
                    ) : (
                        <button
                            onClick={handleClose}
                            className="ml-auto text-sm px-4 py-1.5 rounded-lg text-white transition-colors"
                            style={{ background: 'var(--color-primary, #4f46e5)' }}
                        >
                            我知道了
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
