/**
 * 通知鈴鐺面板 / Notification Bell Panel
 * fixed 定位於右上角，點擊展開公告下拉列表。
 * Fixed at top-right corner; click to open announcement dropdown.
 *
 * 注入於 Layout.jsx 的 sidebar-main 內 / Injected inside Layout.jsx sidebar-main
 */
import { useState, useRef, useEffect } from 'react';
import useNotifyStore from '../stores/notifyStore';
import { IconBell } from './Icons';

const TYPE_DOT = {
    urgent: 'bg-red-500',
    warning: 'bg-amber-400',
    info: 'bg-blue-400',
};

export default function NotificationPanel({ onOpenFeedback }) {
    const {
        announcements,
        unreadIds,
        getUnreadCount,
        markRead,
        markAllRead,
        fetchAnnouncements,
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
        if (!open) {
            fetchAnnouncements(); // 開啟面板時刷新（會命中快取）
        }
        setOpen((prev) => !prev);
    };

    const handleItemClick = (id) => {
        markRead(id);
    };

    // 最新 10 則 / Latest 10
    const items = announcements.slice(0, 10);

    return (
        <div
            ref={panelRef}
            className="fixed z-[150]"
            style={{ top: '12px', right: '14px' }}
        >
            {/* 鈴鐺按鈕 / Bell button */}
            <button
                onClick={handleBellClick}
                className="relative p-2 rounded-full bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label="通知"
            >
                <IconBell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* 下拉面板 / Dropdown panel */}
            {open && (
                <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl shadow-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {/* 標頭 / Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            校園公告
                        </span>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                全部已讀
                            </button>
                        )}
                    </div>

                    {/* 公告列表 / Announcement list */}
                    {items.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                            目前沒有公告
                        </div>
                    ) : (
                        <ul>
                            {items.map((ann) => {
                                const isUnread = unreadIds.includes(ann.id);
                                return (
                                    <li key={ann.id}>
                                        <button
                                            onClick={() => handleItemClick(ann.id)}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                                        >
                                            <div className="flex items-start gap-2">
                                                <span
                                                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                                                        isUnread
                                                            ? TYPE_DOT[ann.type] || 'bg-blue-400'
                                                            : 'bg-transparent'
                                                    }`}
                                                />
                                                <div className="min-w-0">
                                                    <p
                                                        className={`text-sm leading-snug truncate ${
                                                            isUnread
                                                                ? 'font-semibold text-gray-900 dark:text-gray-100'
                                                                : 'text-gray-500 dark:text-gray-400'
                                                        }`}
                                                    >
                                                        {ann.title}
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                                        {ann.body?.slice(0, 40) || ''}
                                                    </p>
                                                    <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">
                                                        {new Date(ann.published_at).toLocaleDateString('zh-TW')}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {/* 底部意見回饋入口 / Bottom feedback entry */}
                    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5">
                        <button
                            onClick={() => {
                                setOpen(false);
                                onOpenFeedback?.();
                            }}
                            className="w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1"
                        >
                            意見回饋
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
