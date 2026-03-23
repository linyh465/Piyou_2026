/**
 * 圖書館狀態管理 / Library Store
 * 呼叫後端 API 取得借閱、預約、歷史資料
 * Calls backend API to fetch loans, reservations, and history.
 *
 * 資安：圖書館資料僅快取於使用者本地端 (localStorage)。
 * Security: library data is cached locally only.
 */
import { create } from 'zustand';
import { api, apiError } from '../services/apiClient';

const REQUEST_TIMEOUT = 25000;

const useLibraryStore = create((set, get) => ({
    // 借閱資料 / Library data
    loans: JSON.parse(localStorage.getItem('piyou_library_loans') || '[]'),
    reserves: JSON.parse(localStorage.getItem('piyou_library_reserves') || '[]'),
    history: JSON.parse(localStorage.getItem('piyou_library_history') || '[]'),
    loansCount: 0,
    overdueCount: 0,

    // 載入狀態 / Loading state
    isLoading: false,
    error: null,

    /**
     * 從後端取得圖書館資料 / Fetch library data from backend
     * 帳密與校務系統共用，需先完成登入同步
     */
    fetchLibrary: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });

        try {
            const res = await api.get('/data/library', { timeout: REQUEST_TIMEOUT });
            const data = res.data;

            const loans = data.loans || [];
            const reserves = data.reserves || [];
            const history = data.history || [];

            localStorage.setItem('piyou_library_loans', JSON.stringify(loans));
            localStorage.setItem('piyou_library_reserves', JSON.stringify(reserves));
            localStorage.setItem('piyou_library_history', JSON.stringify(history));

            set({
                loans,
                reserves,
                history,
                loansCount: data.loans_count || loans.length,
                overdueCount: data.overdue_count || 0,
                isLoading: false,
            });
        } catch (err) {
            const msg = apiError(err, '取得圖書館資料失敗');
            set({ isLoading: false, error: msg });
        }
    },

    /** 清除圖書館快取 / Clear library cache */
    clearLibraryData: () => {
        localStorage.removeItem('piyou_library_loans');
        localStorage.removeItem('piyou_library_reserves');
        localStorage.removeItem('piyou_library_history');
        set({ loans: [], reserves: [], history: [], loansCount: 0, overdueCount: 0 });
    },

    /** 是否有快取資料 / Has cached data */
    hasCachedData: () => {
        const { loans, reserves, history } = get();
        return loans.length > 0 || reserves.length > 0 || history.length > 0;
    },

    /** 取得即將到期書籍（7日內）/ Get books due within 7 days */
    getDueSoonBooks: () => {
        const { loans } = get();
        const now = new Date();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        return loans.filter(book => {
            if (!book.due_date) return false;
            const due = new Date(book.due_date);
            const diff = due.getTime() - now.getTime();
            return diff > 0 && diff <= sevenDays;
        });
    },

    /** 取得逾期書籍 / Get overdue books */
    getOverdueBooks: () => {
        const { loans } = get();
        return loans.filter(book => book.is_overdue);
    },
}));

export default useLibraryStore;
