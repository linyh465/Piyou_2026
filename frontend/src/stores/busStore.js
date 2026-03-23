/**
 * 公車資料全域狀態管理 / Bus Data Global Store
 * 所有公車相關的狀態與 API 呼叫都集中在這裡。
 * Transport 頁面和 Dashboard BusCard 共用同一份資料。
 *
 * 節流策略 / Throttle:
 * - 手動刷新冷卻 60 秒 (UI 按鈕鎖定)
 * - 全域每分鐘最多 2 次 API 呼叫 (含自動 + 手動)
 * - 自動輪詢每 120 秒
 */
import { create } from 'zustand';
import { api, apiError } from '../services/apiClient';
import { trackEvent } from '../services/analytics';

// ── 全域節流常數（TDX 基礎會員每日請求量有限，需保守控制）──
const MANUAL_COOLDOWN_SECONDS = 60;
const AUTO_POLL_INTERVAL = 30_000;  // 自動輪詢 30 秒
const MAX_CALLS_PER_MINUTE = 3;

const useBusStore = create((set, get) => ({
    arrivals: [],
    routeStops: {},      // { "301": { "去程": [...], "返程": [...] }, ... }
    busPositions: [],     // 即時公車位置
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

    // 路線站牌是否已載入 / Whether route stops have been loaded
    _routeStopsLoaded: false,

    /**
     * 取得路線站牌列表 / Fetch route stops (StopOfRoute)
     * 只在首次載入時呼叫一次（資料變動頻率低）
     */
    fetchRouteStops: async () => {
        if (get()._routeStopsLoaded) return;
        try {
            // 先讀本地快取
            const { localDb } = await import('../services/localDb');
            const cached = await localDb.getCache('bus_route_stops');
            if (cached && cached.routes) {
                set({ routeStops: cached.routes, _routeStopsLoaded: true });
                return;
            }
        } catch (e) {
            console.warn('Failed to read route stops cache', e);
        }
        try {
            const res = await api.get('/data/bus/stops');
            const routes = res.data?.routes || {};
            set({ routeStops: routes, _routeStopsLoaded: true });
            // 存入本地快取 (24 小時)
            try {
                const { localDb } = await import('../services/localDb');
                await localDb.setCache('bus_route_stops', res.data, 86400);
            } catch (e) {
                console.warn('Failed to save route stops cache', e);
            }
        } catch (err) {
            console.warn('Failed to fetch route stops', err);
        }
    },

    /**
     * 核心資料抓取 / Core fetch
     * @param {boolean} isManual — 是否為手動觸發（繞過節流）
     */
    fetchBus: async (isManual = false) => {
        const state = get();

        // ── 全域節流：每分鐘最多 MAX_CALLS_PER_MINUTE 次（手動刷新可繞過）──
        const now = Date.now();
        const recentCalls = state._callTimestamps.filter(t => now - t < 60_000);
        if (!isManual && recentCalls.length >= MAX_CALLS_PER_MINUTE) {
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

            set({
                arrivals,
                updatedAt: data.updatedAt || null,
                isLoading: false,
                error: null,
            });
            trackEvent('bus_fetch', { trigger: isManual ? 'manual' : 'auto' }, '/transport');

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
                    ? apiError(err, '載入公車資訊失敗')
                    : null,
            }));
        }
    },

    /**
     * 手動刷新（按鈕觸發）/ Manual refresh (button click)
     * 觸發 60 秒冷卻倒數
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
     * 啟動自動輪詢 / Start auto polling
     */
    startAutoRefresh: () => {
        const state = get();
        if (state._autoInterval) clearInterval(state._autoInterval);

        // 同時取得路線站牌資料
        get().fetchRouteStops();
        get().fetchBus();
        const interval = setInterval(() => get().fetchBus(), AUTO_POLL_INTERVAL);
        set({ _autoInterval: interval });
    },

    /**
     * 停止自動輪詢 / Stop auto polling
     * 同時重設冷卻計時，避免跳頁後倒數繼續 / Reset cooldown to avoid stale timer on navigation
     */
    stopAutoRefresh: () => {
        const { _autoInterval, _cooldownTimer } = get();
        if (_autoInterval) clearInterval(_autoInterval);
        if (_cooldownTimer) clearInterval(_cooldownTimer);
        set({ _autoInterval: null, _cooldownTimer: null, manualCooldown: 0 });
    },
}));

export default useBusStore;
