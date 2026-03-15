/**
 * 圖書館頁面 / Library Page
 * 顯示當前借閱、預約紀錄、借閱歷史
 * Shows current loans, reservations, and borrowing history.
 *
 * RWD：手機直列卡片、桌面寬列卡片
 * RWD: mobile stacked cards, desktop wide cards.
 */
import { useState, useEffect, useRef } from 'react';
import useLibraryStore from '../stores/libraryStore';
import { IconBook, IconRefresh, IconTrash, IconClock, IconCheckCircle, IconStar, IconUser, IconDotsVertical } from '../components/Icons';
import SyncLoginModal from '../components/SyncLoginModal';

/** 到期日顏色 / Due date color */
function dueDateColor(book) {
    if (book.is_overdue) return 'var(--color-danger)';
    if (!book.due_date) return 'var(--text-muted)';
    const now = new Date();
    const due = new Date(book.due_date);
    const diff = (due - now) / (1000 * 60 * 60 * 24);
    if (diff <= 3) return 'var(--color-danger)';
    if (diff <= 7) return 'var(--color-warning)';
    return 'var(--color-success)';
}

/** 到期日文字 / Due date display text */
function dueDateText(book) {
    if (!book.due_date) return '--';
    if (book.is_overdue) return `已逾期 (${book.due_date})`;
    const now = new Date();
    const due = new Date(book.due_date);
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (days <= 0) return `今日到期`;
    if (days === 1) return `明日到期`;
    return `${days} 天後到期`;
}

/** 借閱書籍卡片 / Loan Book Card */
function LoanCard({ book }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            padding: '14px 8px', gap: '12px',
            borderBottom: '1px solid var(--border-light)',
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontSize: '14px', fontWeight: 600, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {book.title}
                </p>
                <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap',
                    fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px',
                }}>
                    {book.author && <span>{book.author}</span>}
                    {book.location && <span>📍 {book.location}</span>}
                    {book.renew_count != null && <span>續借 {book.renew_count} 次</span>}
                </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{
                    fontSize: '13px', fontWeight: 600,
                    color: dueDateColor(book),
                    whiteSpace: 'nowrap',
                }}>
                    {dueDateText(book)}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {book.due_date || ''}
                </p>
            </div>
        </div>
    );
}

/** 預約書籍卡片 / Reservation Card */
function ReserveCard({ book }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 8px',
            borderBottom: '1px solid var(--border-light)',
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontSize: '14px', fontWeight: 600, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {book.title}
                </p>
                <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap',
                    fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px',
                }}>
                    {book.author && <span>{book.author}</span>}
                    {book.pickup_location && <span>📍 {book.pickup_location}</span>}
                </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {book.queue_position && (
                    <span className="badge" style={{
                        background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 600,
                    }}>
                        第 {book.queue_position} 順位
                    </span>
                )}
                {book.status && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {book.status}
                    </p>
                )}
            </div>
        </div>
    );
}

/** 歷史書籍卡片 / History Card */
function HistoryCard({ book }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 8px',
            borderBottom: '1px solid var(--border-light)',
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontSize: '14px', fontWeight: 500, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {book.title}
                </p>
                <div style={{
                    display: 'flex', gap: 8,
                    fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px',
                }}>
                    {book.author && <span>{book.author}</span>}
                    {book.borrow_date && <span>{book.borrow_date}</span>}
                </div>
            </div>
        </div>
    );
}

/** 標籤切換 / Tab buttons */
const TABS = [
    { key: 'loans', label: '當前借閱', icon: IconBook },
    { key: 'reserves', label: '預約紀錄', icon: IconClock },
    { key: 'history', label: '借閱歷史', icon: IconCheckCircle },
];

export default function Library() {
    const {
        loans, reserves, history,
        isLoading, error,
        fetchLibrary, clearLibraryData,
    } = useLibraryStore();

    const [activeTab, setActiveTab] = useState('loans');
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const hasFetched = useRef(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!showMenu) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMenu]);

    useEffect(() => {
        if (!hasFetched.current && loans.length === 0 && reserves.length === 0) {
            hasFetched.current = true;
            fetchLibrary();
        }
    }, [fetchLibrary, loans.length, reserves.length]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchLibrary();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [fetchLibrary]);

    const overdueBooks = loans.filter(b => b.is_overdue);
    const dueSoonBooks = loans.filter(b => {
        if (b.is_overdue || !b.due_date) return false;
        const diff = (new Date(b.due_date) - new Date()) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff > 0;
    });

    return (
        <div className="section-stack">
            {/* 頁面標題 / Page Header */}
            <div className="page-header">
                <div className="page-title-group">
                    <IconBook size={22} style={{ color: 'var(--text-muted)' }} />
                    <h2 className="page-title">圖書館</h2>
                    <span className="page-subtitle">Library</span>
                </div>
                <div className="page-menu-wrapper" ref={menuRef}>
                    {/* 桌面：直接顯示按鈕 */}
                    <div className="page-header-actions">
                        <button
                            onClick={() => setShowSyncModal(true)}
                            className="btn btn-soft"
                            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <IconUser size={14} /> 一鍵登入
                        </button>
                        <button
                            onClick={fetchLibrary}
                            disabled={isLoading}
                            className="btn btn-ghost"
                            style={{ fontSize: '13px' }}
                            aria-label="重新整理圖書館資料"
                        >
                            <IconRefresh size={15} className={isLoading ? 'animate-spin' : ''} />
                            {isLoading ? '載入中...' : '重新整理'}
                        </button>
                        {(loans.length > 0 || reserves.length > 0 || history.length > 0) && (
                            <button
                                onClick={() => { if (window.confirm('確定要清除圖書館資料嗎？')) clearLibraryData(); }}
                                className="btn btn-ghost"
                                style={{ fontSize: '13px', color: 'var(--color-danger)' }}
                                aria-label="清除圖書館資料"
                            >
                                <IconTrash size={15} />
                                清除
                            </button>
                        )}
                    </div>
                    {/* 手機：收納按鈕 */}
                    <button className="page-header-menu-btn" onClick={() => setShowMenu(v => !v)} aria-label="更多操作">
                        <IconDotsVertical size={18} />
                    </button>
                    {showMenu && (
                        <div className="page-menu-dropdown">
                            <button onClick={() => { setShowSyncModal(true); setShowMenu(false); }} className="btn btn-soft">
                                <IconUser size={14} /> 一鍵登入
                            </button>
                            <button onClick={() => { fetchLibrary(); setShowMenu(false); }} disabled={isLoading} className="btn btn-ghost">
                                <IconRefresh size={14} className={isLoading ? 'animate-spin' : ''} /> 重新整理
                            </button>
                            {(loans.length > 0 || reserves.length > 0 || history.length > 0) && (
                                <button onClick={() => { setShowMenu(false); if (window.confirm('確定要清除圖書館資料嗎？')) clearLibraryData(); }} className="btn btn-ghost" style={{ color: 'var(--color-danger)' }}>
                                    <IconTrash size={14} /> 清除資料
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 錯誤訊息 / Error */}
            {error && (
                <div className="card" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245,158,11,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-warning)' }}>⚠️ {error}</p>
                </div>
            )}

            {/* 逾期警告 / Overdue Alert */}
            {overdueBooks.length > 0 && (
                <div className="card" style={{
                    borderColor: 'var(--color-danger)',
                    background: 'rgba(239,68,68,0.06)',
                    borderLeft: '4px solid var(--color-danger)',
                }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-danger)', marginBottom: '6px' }}>
                        ⚠️ {overdueBooks.length} 本書已逾期
                    </p>
                    {overdueBooks.map((b, i) => (
                        <p key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            • {b.title} — 到期日 {b.due_date}
                        </p>
                    ))}
                </div>
            )}

            {/* 即將到期提醒 / Due Soon Alert */}
            {dueSoonBooks.length > 0 && overdueBooks.length === 0 && (
                <div className="card" style={{
                    borderColor: 'var(--color-warning)',
                    background: 'rgba(245,158,11,0.04)',
                    borderLeft: '4px solid var(--color-warning)',
                }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-warning)', marginBottom: '6px' }}>
                        📅 {dueSoonBooks.length} 本書即將到期（7 日內）
                    </p>
                    {dueSoonBooks.map((b, i) => (
                        <p key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            • {b.title} — {dueDateText(b)}
                        </p>
                    ))}
                </div>
            )}

            {/* 統計卡片 / Stats Card */}
            {!isLoading && loans.length > 0 && (
                <div className="card" style={{
                    background: 'linear-gradient(135deg, var(--color-brand-subtle) 0%, rgba(99,102,241,0.06) 100%)',
                }}>
                    <p style={{
                        fontSize: '12px', fontWeight: 600, color: 'var(--color-brand)',
                        marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                        📚 借閱總覽
                    </p>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{loans.length}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>借閱中</p>
                        </div>
                        {overdueBooks.length > 0 && (
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>{overdueBooks.length}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>已逾期</p>
                            </div>
                        )}
                        {dueSoonBooks.length > 0 && (
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-warning)' }}>{dueSoonBooks.length}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>即將到期</p>
                            </div>
                        )}
                        {reserves.length > 0 && (
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{reserves.length}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>預約中</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 標籤切換 / Tab Navigation */}
            {!isLoading && (loans.length > 0 || reserves.length > 0 || history.length > 0) && (
                <div style={{
                    display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px',
                }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                            role="tab"
                            aria-selected={activeTab === tab.key}
                            aria-label={tab.label}
                            style={{
                                fontSize: '12px', padding: '6px 14px',
                                whiteSpace: 'nowrap', borderRadius: '20px',
                                display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                            {tab.key === 'loans' && loans.length > 0 && (
                                <span style={{
                                    marginLeft: '4px', fontSize: '11px',
                                    background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--color-brand-subtle)',
                                    color: activeTab === tab.key ? '#fff' : 'var(--color-brand)',
                                    padding: '1px 6px', borderRadius: '10px', fontWeight: 700,
                                }}>
                                    {loans.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* 骨架屏 / Skeleton */}
            {isLoading && (
                <div className="card-stack">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="skeleton" style={{ height: '20px', width: '160px' }} />
                            <div className="skeleton" style={{ height: '16px', width: '100%' }} />
                            <div className="skeleton" style={{ height: '16px', width: '75%' }} />
                        </div>
                    ))}
                </div>
            )}

            {/* 當前借閱 / Current Loans */}
            {!isLoading && activeTab === 'loans' && (
                <div className="card-stack">
                    {loans.length > 0 ? (
                        <div className="card">
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
                            }}>
                                <IconBook size={18} style={{ color: 'var(--color-brand)' }} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                                    當前借閱
                                </h3>
                                <span className="badge" style={{
                                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 700,
                                }}>
                                    {loans.length} 本
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {loans.map((book, i) => (
                                    <LoanCard key={i} book={book} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState icon={IconBook} title="沒有借閱中的書籍" subtitle="前往蓋夏圖書館借閱書籍吧" />
                    )}
                </div>
            )}

            {/* 預約紀錄 / Reservations */}
            {!isLoading && activeTab === 'reserves' && (
                <div className="card-stack">
                    {reserves.length > 0 ? (
                        <div className="card">
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
                            }}>
                                <IconClock size={18} style={{ color: 'var(--color-brand)' }} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                                    預約紀錄
                                </h3>
                                <span className="badge" style={{
                                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 700,
                                }}>
                                    {reserves.length} 筆
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {reserves.map((book, i) => (
                                    <ReserveCard key={i} book={book} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState icon={IconClock} title="沒有預約紀錄" subtitle="預約的書籍會顯示在這裡" />
                    )}
                </div>
            )}

            {/* 借閱歷史 / History */}
            {!isLoading && activeTab === 'history' && (
                <div className="card-stack">
                    {history.length > 0 ? (
                        <div className="card">
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
                            }}>
                                <IconCheckCircle size={18} style={{ color: 'var(--color-brand)' }} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                                    借閱歷史
                                </h3>
                                <span className="badge" style={{
                                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 700,
                                }}>
                                    {history.length} 筆
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {history.map((book, i) => (
                                    <HistoryCard key={i} book={book} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState icon={IconCheckCircle} title="沒有借閱歷史" subtitle="借閱過的書籍會顯示在這裡" />
                    )}
                </div>
            )}

            {/* 初始空狀態 / Initial empty state */}
            {!isLoading && loans.length === 0 && reserves.length === 0 && history.length === 0 && !error && (
                <EmptyState icon={IconBook} title="尚無圖書館資料" subtitle="請先登入以同步借閱資料" />
            )}

            {/* 同步登入 Modal */}
            <SyncLoginModal show={showSyncModal} onClose={() => setShowSyncModal(false)} />
        </div>
    );
}

/** 空資料狀態 / Empty State */
function EmptyState({ icon: Icon, title, subtitle }) {
    return (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Icon size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{title}</p>
            <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>
                {subtitle}
            </p>
        </div>
    );
}
