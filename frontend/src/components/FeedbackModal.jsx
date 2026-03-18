/**
 * 意見回饋 Modal / Feedback Modal
 * 學生送出匿名回饋，管理員回覆後可查詢。
 * Students submit anonymous feedback; admin replies are queryable.
 */
import { useState } from 'react';
import useNotifyStore from '../stores/notifyStore';

const CATEGORIES = [
    { value: 'bug', label: '🐛 回報問題' },
    { value: 'feature', label: '💡 功能建議' },
    { value: 'question', label: '❓ 使用疑問' },
    { value: 'other', label: '💬 其他' },
];

const MAX_CONTENT = 1000;

export default function FeedbackModal({ show, onClose }) {
    const { submitFeedback, getFeedbackReply } = useNotifyStore();

    // 送出表單狀態
    const [category, setCategory] = useState('bug');
    const [content, setContent] = useState('');
    const [contact, setContact] = useState('');
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
        const result = await submitFeedback({ category, content: content.trim(), contact: contact.trim() });
        setSubmitting(false);
        if (result.ok) {
            setSubmitted(true);
            setSubmittedId(result.id);
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
        // 重置狀態 / Reset state
        setCategory('bug');
        setContent('');
        setContact('');
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
                {/* 標題列 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">意見回饋</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
                        aria-label="關閉"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-5 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    {!submitted ? (
                        /* 送出表單 / Submit form */
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* 類別 */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                    類別
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CATEGORIES.map((c) => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => setCategory(c.value)}
                                            className={`text-sm py-2 px-3 rounded-lg border transition-colors text-left ${
                                                category === c.value
                                                    ? 'border-transparent text-white'
                                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                            style={category === c.value ? { background: 'var(--color-primary, #4f46e5)' } : undefined}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 內容 */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                    內容（至少 10 字）
                                </label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
                                    rows={4}
                                    placeholder="請描述您的問題或建議..."
                                    className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600"
                                />
                                <div className="text-right text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    {content.length} / {MAX_CONTENT}
                                </div>
                            </div>

                            {/* 聯絡方式（選填） */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                    聯絡方式（選填，留空即匿名）
                                </label>
                                <input
                                    type="text"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value.slice(0, 100))}
                                    placeholder="e-mail 或其他聯絡方式"
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600"
                                />
                            </div>

                            {submitError && (
                                <p className="text-xs text-red-500 dark:text-red-400">{submitError}</p>
                            )}

                            <button
                                type="submit"
                                disabled={submitting || content.trim().length < 10}
                                className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-opacity"
                                style={{ background: 'var(--color-primary, #4f46e5)' }}
                            >
                                {submitting ? '送出中…' : '送出回饋'}
                            </button>
                        </form>
                    ) : (
                        /* 送出成功 / Submit success */
                        <div className="text-center space-y-3 py-2">
                            <div className="text-3xl">✅</div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">回饋已送出，謝謝！</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                您的回饋 ID（可用於查詢管理員回覆）：
                            </p>
                            <code className="block text-xs bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 break-all text-gray-700 dark:text-gray-200 select-all">
                                {submittedId}
                            </code>
                        </div>
                    )}

                    {/* 查詢回覆區 / Reply query section */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">查詢管理員回覆</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={queryId}
                                onChange={(e) => setQueryId(e.target.value)}
                                placeholder="貼上回饋 ID"
                                className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                            <button
                                onClick={handleQuery}
                                disabled={querying || !queryId.trim()}
                                className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                            >
                                {querying ? '查詢中…' : '查詢'}
                            </button>
                        </div>

                        {queryError && (
                            <p className="text-xs text-red-500 dark:text-red-400">{queryError}</p>
                        )}

                        {queryResult && (
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 space-y-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    狀態：
                                    <span className={`font-medium ${queryResult.status === 'replied' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>
                                        {queryResult.status === 'replied' ? '已回覆' : '待處理'}
                                    </span>
                                </p>
                                {queryResult.admin_reply && (
                                    <>
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mt-1">管理員回覆：</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
                                            {queryResult.admin_reply}
                                        </p>
                                        {queryResult.replied_at && (
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                                {new Date(queryResult.replied_at).toLocaleDateString('zh-TW')}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
