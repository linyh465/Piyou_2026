/**
 * 儀表板狀態管理 / Dashboard Store
 * 整合下一堂課資訊與 TDX 公車即時倒數
 * Aggregates next-class info and TDX bus real-time countdown.
 */
import { create } from 'zustand';
import { api } from '../services/apiClient';
import useTimetableStore from './timetableStore';

const useDashboardStore = create((set, get) => ({
    // 公車資料 / Bus data
    busArrivals: [],
    isBusLoading: false,
    busError: null,
    busCountdown: null, // 秒數 / seconds

    // 更新計時器 / Refresh timer
    _busInterval: null,
    _countdownInterval: null,

    /**
     * 取得下一堂課 / Get next class info
     * 委派給 timetableStore 計算
     * Delegates computation to timetableStore.
     */
    getNextClass: () => {
        return useTimetableStore.getState().getNextClass();
    },

    /**
     * 取得公車到站資訊 / Fetch bus arrival data
     * 呼叫 TDX API 介接端點
     * Calls TDX API integration endpoint.
     */
    fetchBusArrivals: async () => {
        set({ isBusLoading: true, busError: null });
        try {
            const res = await api.get('/data/bus');
            const arrivals = res.data.arrivals || [];

            // 計算最近一班的倒數秒數 / Calculate countdown for nearest bus
            let countdown = null;
            if (arrivals.length > 0) {
                const nearest = arrivals[0];
                countdown = nearest.estimatedSeconds || null;
            }

            set({
                busArrivals: arrivals,
                isBusLoading: false,
                busCountdown: countdown,
            });
        } catch (err) {
            set({
                isBusLoading: false,
                busError: err.response?.data?.detail || '載入公車資訊失敗 / Failed to load bus info',
            });
        }
    },

    /**
     * 啟動自動更新 / Start auto-refresh
     * 公車資料每30秒刷新，倒數每秒遞減
     * Bus data refreshes every 30s, countdown decrements every second.
     */
    startAutoRefresh: () => {
        const state = get();

        // 清除既有計時器 / Clear existing timers
        if (state._busInterval) clearInterval(state._busInterval);
        if (state._countdownInterval) clearInterval(state._countdownInterval);

        // 公車每30秒更新 / Bus refresh every 30s
        get().fetchBusArrivals();
        const busInterval = setInterval(() => get().fetchBusArrivals(), 30000);

        // 倒數每秒遞減 / Countdown decrements every second
        const countdownInterval = setInterval(() => {
            const { busCountdown } = get();
            if (busCountdown !== null && busCountdown > 0) {
                set({ busCountdown: busCountdown - 1 });
            }
        }, 1000);

        set({ _busInterval: busInterval, _countdownInterval: countdownInterval });
    },

    /**
     * 停止自動更新 / Stop auto-refresh
     */
    stopAutoRefresh: () => {
        const { _busInterval, _countdownInterval } = get();
        if (_busInterval) clearInterval(_busInterval);
        if (_countdownInterval) clearInterval(_countdownInterval);
        set({ _busInterval: null, _countdownInterval: null });
    },
}));

export default useDashboardStore;
