/**
 * 圖書館頁面 / Library Page
 * 顯示當前借閱、預約紀錄、借閱歷史
 * Shows current loans, reservations, and borrowing history.
 *
 * RWD：手機直列卡片、桌面寬列卡片
 * RWD: mobile stacked cards, desktop wide cards.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useLibraryStore from '../stores/libraryStore';
import { IconBook, IconRefresh, IconTrash, IconClock, IconCheckCircle, IconStar, IconUser, IconDotsVertical, IconXCircle } from '../components/Icons';
import SyncLoginModal from '../components/SyncLoginModal';

/** 書籍詳細 Modal / Book detail bottom sheet */
function BookDetailModal({ book, onClose }) {
    if (!book) return null;
    const rows = [
        book.author && { label: '作者', value: book.author },
        book.call_number && { label: '索書號', value: book.call_number },
        book.barcode && { label: '館藏條碼', value: book.barcode },
        (book.location || book.pickup_location) && { label: '館藏位置', value: book.location || book.pickup_location },
        book.collection_type && { label: '館藏類型', value: book.collection_type },
        book.due_date && { label: '還書期限', value: book.due_date },
        book.borrow_date && { label: '借書日期', value: book.borrow_date },
        book.renew_count != null && { label: '續借次數', value: `${book.renew_count} 次` },
        book.queue_position && { label: '預約排序', value: `第 ${book.queue_position} 位` },
        book.is_overdue && { label: '狀態', value: '逾期', warn: true },
    ].filter(Boolean);
    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 900, backdropFilter: 'blur(2px)' }} />
            <div style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 901,
                background: 'var(--bg-card)', borderRadius: '20px 20px 0 0',
                padding: '20px 20px calc(env(safe-area-inset-bottom,0px) + 24px)',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
                maxHeight: '80vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', flex: 1, marginRight: '12px', lineHeight: 1.4 }}>{book.title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }}>
                        <IconXCircle size={22} />
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {rows.map(({ label, value, warn }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: warn ? 'var(--color-danger)' : 'var(--text)', textAlign: 'right' }}>{value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

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
function dueDateText(book, t) {
    if (!book.due_date) return '--';
    if (book.is_overdue) return t('dueDateStatus.overdue', { date: book.due_date });
    const now = new Date();
    const due = new Date(book.due_date);
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (days <= 0) return t('dueDateStatus.today');
    if (days === 1) return t('dueDateStatus.tomorrow');
    return t('dueDateStatus.daysLater', { n: days });
}

/** 借閱書籍卡片 / Loan Book Card */
function LoanCard({ book, onClick }) {
    const { t } = useTranslation('library');
    return (
        <div onClick={onClick} style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            padding: '14px 8px', gap: '12px',
            borderBottom: '1px solid var(--border-light)',
            cursor: 'pointer',
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
                    {book.renew_count != null && <span>{t('renewCount', { n: book.renew_count })}</span>}
                </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{
                    fontSize: '13px', fontWeight: 600,
                    color: dueDateColor(book),
                    whiteSpace: 'nowrap',
                }}>
                    {dueDateText(book, t)}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {book.due_date || ''}
                </p>
            </div>
        </div>
    );
}

/** 預約書籍卡片 / Reservation Card */
function ReserveCard({ book, onClick }) {
    const { t } = useTranslation('library');
    return (
        <div onClick={onClick} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 8px',
            borderBottom: '1px solid var(--border-light)',
            cursor: 'pointer',
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
                        {t('queuePosition', { n: book.queue_position })}
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
function HistoryCard({ book, onClick }) {
    return (
        <div onClick={onClick} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 8px',
            borderBottom: '1px solid var(--border-light)',
            cursor: 'pointer',
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

export default function Library() {
    const { t } = useTranslation('library');
    const { t: tCommon } = useTranslation('common');
    const {
        loans, reserves, history,
        isLoading, error,
        fetchLibrary, clearLibraryData,
    } = useLibraryStore();

    const [activeTab, setActiveTab] = useState('loans');
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [selectedBook, setSelectedBook] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const hasFetched = useRef(false);
    const menuRef = useRef(null);

    const tabs = [
        { key: 'loans', label: t('tabs.loans'), icon: IconBook },
        { key: 'reserves', label: t('tabs.reserves'), icon: IconClock },
        { key: 'history', label: t('tabs.history'), icon: IconCheckCircle },
    ];

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
                    <h2 className="page-title">{t('title')}</h2>
                </div>
                <div className="page-menu-wrapper" ref={menuRef}>
                    <div className="page-header-actions">
                        <button
                            onClick={() => setShowSyncModal(true)}
                            className="btn btn-soft"
                            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <IconUser size={14} /> {tCommon('signIn')}
                        </button>
                        <button
                            onClick={fetchLibrary}
                            disabled={isLoading}
                            className="btn btn-ghost"
                            style={{ fontSize: '13px' }}
                            aria-label={tCommon('refresh')}
                        >
                            <IconRefresh size={15} className={isLoading ? 'animate-spin' : ''} />
                            {isLoading ? tCommon('loading') : tCommon('refresh')}
                        </button>
                        {(loans.length > 0 || reserves.length > 0 || history.length > 0) && (
                            <button
                                onClick={() => { if (window.confirm(t('clearConfirm'))) clearLibraryData(); }}
                                className="btn btn-ghost"
                                style={{ fontSize: '13px', color: 'var(--color-danger)' }}
                                aria-label={tCommon('clear')}
                            >
                                <IconTrash size={15} />
                                {tCommon('clear')}
                            </button>
                        )}
                    </div>
                    <button className="page-header-menu-btn" onClick={() => setShowMenu(v => !v)} aria-label={tCommon('moreActions')}>
                        <IconDotsVertical size={18} />
                    </button>
                    {showMenu && (
                        <div className="page-menu-dropdown">
                            <button onClick={() => { setShowSyncModal(true); setShowMenu(false); }} className="btn btn-soft">
                                <IconUser size={14} /> {tCommon('signIn')}
                            </button>
                            <button onClick={() => { fetchLibrary(); setShowMenu(false); }} disabled={isLoading} className="btn btn-ghost">
                                <IconRefresh size={14} className={isLoading ? 'animate-spin' : ''} /> {tCommon('refresh')}
                            </button>
                            {(loans.length > 0 || reserves.length > 0 || history.length > 0) && (
                                <button onClick={() => { setShowMenu(false); if (window.confirm(t('clearConfirm'))) clearLibraryData(); }} className="btn btn-ghost" style={{ color: 'var(--color-danger)' }}>
                                    <IconTrash size={14} /> {tCommon('clear')}
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
                        {t('overdueBooksAlert', { count: overdueBooks.length })}
                    </p>
                    {overdueBooks.map((b, i) => (
                        <p key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            • {b.title} — {t('dueDate', { date: b.due_date })}
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
                        {t('dueSoonAlert', { count: dueSoonBooks.length })}
                    </p>
                    {dueSoonBooks.map((b, i) => (
                        <p key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            • {b.title} — {dueDateText(b, t)}
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
                        {t('loansOverview')}
                    </p>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{loans.length}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('borrowing')}</p>
                        </div>
                        {overdueBooks.length > 0 && (
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>{overdueBooks.length}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('overdue')}</p>
                            </div>
                        )}
                        {dueSoonBooks.length > 0 && (
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-warning)' }}>{dueSoonBooks.length}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('dueSoon')}</p>
                            </div>
                        )}
                        {reserves.length > 0 && (
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{reserves.length}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('reserving')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 標籤切換 / Tab Navigation */}
            {!isLoading && (loans.length > 0 || reserves.length > 0 || history.length > 0) && (
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {tabs.map(tab => (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <IconBook size={18} style={{ color: 'var(--color-brand)' }} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                                    {t('currentLoans')}
                                </h3>
                                <span className="badge" style={{
                                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 700,
                                }}>
                                    {t('countBooks', { n: loans.length })}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {loans.map((book, i) => (
                                    <LoanCard key={i} book={book} onClick={() => setSelectedBook(book)} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState icon={IconBook} title={t('noBooksLoaned')} subtitle={t('goToBorrow')} />
                    )}
                </div>
            )}

            {/* 預約紀錄 / Reservations */}
            {!isLoading && activeTab === 'reserves' && (
                <div className="card-stack">
                    {reserves.length > 0 ? (
                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <IconClock size={18} style={{ color: 'var(--color-brand)' }} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                                    {t('reservations')}
                                </h3>
                                <span className="badge" style={{
                                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 700,
                                }}>
                                    {t('countRecords', { n: reserves.length })}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {reserves.map((book, i) => (
                                    <ReserveCard key={i} book={book} onClick={() => setSelectedBook(book)} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState icon={IconClock} title={t('noReservations')} subtitle={t('reservationsHint')} />
                    )}
                </div>
            )}

            {/* 借閱歷史 / History */}
            {!isLoading && activeTab === 'history' && (
                <div className="card-stack">
                    {history.length > 0 ? (
                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <IconCheckCircle size={18} style={{ color: 'var(--color-brand)' }} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                                    {t('borrowHistory')}
                                </h3>
                                <span className="badge" style={{
                                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 700,
                                }}>
                                    {t('countRecords', { n: history.length })}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {history.map((book, i) => (
                                    <HistoryCard key={i} book={book} onClick={() => setSelectedBook(book)} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState icon={IconCheckCircle} title={t('noHistory')} subtitle={t('historyHint')} />
                    )}
                </div>
            )}

            {/* 初始空狀態 / Initial empty state */}
            {!isLoading && loans.length === 0 && reserves.length === 0 && history.length === 0 && !error && (
                <EmptyState icon={IconBook} title={t('noData')} subtitle={t('loginHint')} />
            )}

            {/* 同步登入 Modal */}
            <SyncLoginModal show={showSyncModal} onClose={() => setShowSyncModal(false)} />
            <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)} />
        </div>
    );
}
