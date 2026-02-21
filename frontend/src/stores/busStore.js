/**
 * 公車資料全域狀態管理 / Bus Data Global Store
 * 所有公車相關的狀態與 API 呼叫都集中在這裡。
 * Transport 頁面和 Dashboard BusCard 共用同一份資料。
 *
 * 節流策略 / Throttle:
 * - 手動刷新冷卻 20 秒 (UI 按鈕鎖定)
 * - 全域每分鐘最多 5 次 API 呼叫 (含自動 + 手動)
 * - 自動輪詢每 30 秒
 */
import { create } from 'zustand';
import { api } from '../services/apiClient';

// ── 全域節流常數 ──
const MANUAL_COOLDOWN_SECONDS = 20;
const MAX_CALLS_PER_MINUTE = 5;

const useBusStore = create((set, get) => ({
    arrivals: [],
    isLoading: false,
    error: null,
    updatedAt: null,

    // 手動刷新冷卻 / Manual refresh cooldown
    manualCooldown: 0,

    // 每分鐘呼叫紀錄 / Per-minute call log
    _callTimestamps: [],

    // 自動輪詢 timer
    _autoInterval: null,

    // 倒數 timer
    _cooldownTimer: null,

    /**
     * 核心資料抓取 / Core fetch
     * @param {boolean} isManual — 是否為手動觸發
     */
    fetchBus: async (isManual = false) => {
        const state = get();

        // ── 全域節流：每分鐘最多 MAX_CALLS_PER_MINUTE 次 ──
        const now = Date.now();
        const recentCalls = state._callTimestamps.filter(t => now - t < 60_000);
        if (recentCalls.length >= MAX_CALLS_PER_MINUTE) {
            console.warn(`Bus API rate limit: ${MAX_CALLS_PER_MINUTE} calls/min exceeded`);
            return; // 靜默跳過
        }

        // ── 首次載入：先讀本地快取 ──
        if (state.arrivals.length === 0) {
            try {
                const { localDb } = await import('../services/localDb');
                const cached = await localDb.getCache('bus_data');
                if (cached && cached.arrivals) {
                    set({ arrivals: cached.arrivals, updatedAt: cached.updatedAt || null });
                }
            } catch (e) {
                console.warn('Failed to read local bus cache', e);
            }
        }

        set({
            isLoading: true,
            error: null,
            _callTimestamps: [...recentCalls, now],
        });

        try {
            const res = await api.get('/data/bus');
            const data = res.data;
            const arrivals = data.arrivals || [];

            // 排序：按到站時間
            arrivals.sort((a, b) => {
                if (a.estimatedSeconds === null) return 1;
                if (b.estimatedSeconds === null) return -1;
                return a.estimatedSeconds - b.estimatedSeconds;
            });

            set({
                arrivals,
                updatedAt: data.updatedAt || null,
                isLoading: false,
                error: null,
            });

            // 存入本地快取
            try {
                const { localDb } = await import('../services/localDb');
                await localDb.setCache('bus_data', data, 600);
            } catch (e) {
                console.warn('Failed to save bus cache', e);
            }
        } catch (err) {
            set(prev => ({
                isLoading: false,
                error: prev.arrivals.length === 0
                    ? (err.response?.data?.detail || '載入公車資訊失敗')
                    : null,
            }));
        }
    },

    /**
     * 手動刷新（按鈕觸發）/ Manual refresh (button click)
     * 觸發 20 秒冷卻倒數
     */
    manualRefresh: () => {
        const state = get();
        if (state.manualCooldown > 0) return;

        // 開始冷卻倒數
        set({ manualCooldown: MANUAL_COOLDOWN_SECONDS });

        // 清除舊 timer
        if (state._cooldownTimer) clearInterval(state._cooldownTimer);

        const timer = setInterval(() => {
            const cd = get().manualCooldown;
            if (cd <= 1) {
                clearInterval(timer);
                set({ manualCooldown: 0, _cooldownTimer: null });
            } else {
                set({ manualCooldown: cd - 1 });
            }
        }, 1000);
        set({ _cooldownTimer: timer });

        get().fetchBus(true);
    },

    /**
     * 啟動自動輪詢 / Start auto polling (30s)
     */
    startAutoRefresh: () => {
        const state = get();
        if (state._autoInterval) clearInterval(state._autoInterval);

        get().fetchBus();
        const interval = setInterval(() => get().fetchBus(), 30_000);
        set({ _autoInterval: interval });
    },

    /**
     * 停止自動輪詢 / Stop auto polling
     */
    stopAutoRefresh: () => {
        const { _autoInterval, _cooldownTimer } = get();
        if (_autoInterval) clearInterval(_autoInterval);
        if (_cooldownTimer) clearInterval(_cooldownTimer);
        set({ _autoInterval: null, _cooldownTimer: null });
    },
}));

export default useBusStore;
