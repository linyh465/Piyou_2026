/**
 * 儀表板狀態管理 / Dashboard Store
 * 僅提供「下一堂課」計算；公車資料已統一由 busStore 管理。
 * Only provides "next class" computation; bus data is managed by busStore.
 */
import { create } from 'zustand';
import useTimetableStore from './timetableStore';

const useDashboardStore = create(() => ({
    /**
     * 取得下一堂課 / Get next class info
     * 委派給 timetableStore 計算
     * Delegates computation to timetableStore.
     */
    getNextClass: () => {
        return useTimetableStore.getState().getNextClass();
    },
}));

export default useDashboardStore;
