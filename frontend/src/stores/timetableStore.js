/**
 * 課表與成績狀態管理 / Timetable & Grades Store
 * 呼叫後端 API 並處理 Loading、Timeout、Error 狀態
 * Calls backend API with Loading, Timeout, and Error state handling.
 *
 * 資安：課表、成績僅快取於使用者本地端 (localStorage)，不上傳至雲端。
 * Security: timetable/grades are cached locally only, never uploaded to cloud.
 *
 * 同步冷卻：伺服器端裝置獨立冷卻，前端僅做 UI 顯示。
 * Sync cooldown: server-side per-device cooldown via X-Device-Id; frontend is display-only.
 */
import { create } from 'zustand';
import { api } from '../services/apiClient';

// 請求超時時間 / Request timeout duration
const REQUEST_TIMEOUT = 25000;
const SYNC_TIMEOUT = 30000; // 同步操作允許更長時間 / Sync operations allow more time

// 資料世代計數器：每次清除資料時遞增，用於取消尚在飛行中的請求寫回
// Data generation counter: incremented on clear to discard stale in-flight writes
let _dataGeneration = 0;

const useTimetableStore = create((set, get) => ({
    // 課表狀態 / Timetable state
    timetable: JSON.parse(localStorage.getItem('piyou_timetable') || '[]'),
    grades: JSON.parse(localStorage.getItem('piyou_grades') || '[]'),
    isLoadingTimetable: false,
    isLoadingGrades: false,
    timetableError: null,
    gradesError: null,
    isTimeout: false,

    // 同步限制狀態（伺服器端強制） / Sync rate limiting state (server-side enforced)
    // 前端保留 lastSyncTime 僅供 UI 顯示；冷卻由伺服器判定
    // Frontend keeps lastSyncTime for UI display only; cooldown is server-enforced
    lastSyncTime: parseInt(localStorage.getItem('piyou_last_sync') || '0', 10),
    serverCooldown: null, // { allowed, reason?, remaining_seconds? }

    /**
     * 向伺服器查詢冷卻狀態 / Query server for cooldown status
     * 回傳 { allowed, reason?, remainingMs? }
     */
    canSync: async () => {
        try {
            const res = await api.get('/auth/sync-cooldown', { timeout: 5000 });
            const data = res.data;
            const result = {
                allowed: data.allowed,
                reason: data.reason || null,
                remainingMs: data.remaining_seconds != null ? data.remaining_seconds * 1000 : 0,
            };
            set({ serverCooldown: result });
            return result;
        } catch {
            // 伺服器無法連線時，回退到本地檢查 / Fallback to local check on server error
            const lastSync = get().lastSyncTime;
            const now = Date.now();
            const FALLBACK_COOLDOWN_MS = 10 * 60 * 1000;
            if (lastSync && (now - lastSync) < FALLBACK_COOLDOWN_MS) {
                return { allowed: false, reason: 'cooldown', remainingMs: FALLBACK_COOLDOWN_MS - (now - lastSync) };
            }
            return { allowed: true };
        }
    },

    /** 記錄同步成功（僅更新本地 UI 顯示用時間） / Record sync success (UI display only) */
    recordSyncSuccess: () => {
        const now = Date.now();
        localStorage.setItem('piyou_last_sync', String(now));
        set({ lastSyncTime: now });
    },

    /** 記錄同步錯誤（伺服器端已追蹤，前端無需額外邏輯）/ Record sync error (server-side tracked) */
    recordSyncError: () => {
        // 伺服器端已自動追蹤錯誤次數與鎖定
        // Server already tracks error count and lock
    },

    /** 是否有快取的校務資料 / Has cached school data */
    hasCachedData: () => {
        const { timetable, grades } = get();
        return timetable.length > 0 || grades.length > 0;
    },

    /** 清除所有校務快取資料（不清除冷卻紀錄）/ Clear all cached school data (cooldown preserved) */
    clearSchoolData: () => {
        _dataGeneration++; // 使飛行中的請求過期 / Invalidate in-flight requests
        localStorage.removeItem('piyou_timetable');
        localStorage.removeItem('piyou_grades');
        // 注意：不再清除 piyou_last_sync，冷卻由伺服器端強制執行
        // Note: piyou_last_sync is NOT cleared; cooldown is server-enforced
        sessionStorage.removeItem('piyou_token');
        set({ timetable: [], grades: [] });
    },

    /** 僅清除課表快取 / Clear only timetable cache */
    clearTimetableData: () => {
        _dataGeneration++; // 使飛行中的請求過期 / Invalidate in-flight requests
        localStorage.removeItem('piyou_timetable');
        sessionStorage.removeItem('piyou_token');
        set({ timetable: [] });
    },

    /** 僅清除成績快取 / Clear only grades cache */
    clearGradesData: () => {
        _dataGeneration++; // 使飛行中的請求過期 / Invalidate in-flight requests
        localStorage.removeItem('piyou_grades');
        sessionStorage.removeItem('piyou_token');
        set({ grades: [] });
    },

    /**
     * 取得課表 / Fetch timetable
     * 向 GET /data/timetable 發送請求，含 10 秒超時處理
     * Sends GET /data/timetable with 10s timeout handling.
     */
    fetchTimetable: async () => {
        const token = sessionStorage.getItem('piyou_token');
        if (!token) return; // 未認證時使用 localStorage 快取即可

        const gen = _dataGeneration; // 快照世代 / Snapshot generation
        set({ isLoadingTimetable: true, timetableError: null, isTimeout: false });
        try {
            const res = await api.get('/data/timetable', { timeout: SYNC_TIMEOUT });
            // 若資料已被清除（世代不符），丟棄回應 / Discard if data was cleared
            if (_dataGeneration !== gen) return set({ isLoadingTimetable: false });
            const data = res.data.courses || [];
            localStorage.setItem('piyou_timetable', JSON.stringify(data));
            set({
                timetable: data,
                isLoadingTimetable: false,
                timetableError: null,
                isTimeout: false,
            });
        } catch (err) {
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                set({
                    isLoadingTimetable: false,
                    isTimeout: true,
                    timetableError: '請求逾時，請稍後再試 / Request timed out, please try again',
                });
            } else if (err.response?.status === 401) {
                // Ignore 401, user is just using local data
                set({
                    isLoadingTimetable: false,
                    timetableError: null,
                });
            } else {
                set({
                    isLoadingTimetable: false,
                    timetableError: err.response?.data?.detail || '載入課表失敗 / Failed to load timetable',
                });
            }
        }
    },

    /**
     * 取得成績 / Fetch grades
     * 向 GET /data/grades 發送請求
     * Sends GET /data/grades request.
     */
    fetchGrades: async () => {
        const token = sessionStorage.getItem('piyou_token');
        if (!token) return; // 未認證時使用 localStorage 快取即可

        const gen = _dataGeneration; // 快照世代 / Snapshot generation
        set({ isLoadingGrades: true, gradesError: null });
        try {
            const res = await api.get('/data/grades', { timeout: SYNC_TIMEOUT });
            // 若資料已被清除（世代不符），丟棄回應 / Discard if data was cleared
            if (_dataGeneration !== gen) return set({ isLoadingGrades: false });
            const data = res.data.semesters || [];
            localStorage.setItem('piyou_grades', JSON.stringify(data));
            set({
                grades: data,
                isLoadingGrades: false,
                gradesError: null,
            });
        } catch (err) {
            if (err.response?.status === 401) {
                set({ isLoadingGrades: false, gradesError: null }); // Ignore 401
            } else {
                set({
                    isLoadingGrades: false,
                    gradesError: err.response?.data?.detail || '載入成績失敗 / Failed to load grades',
                });
            }
        }
    },

    /**
     * 取得下一堂課 / Get next class
     * 根據目前時間從課表計算下一堂課資訊
     * Computes next class info from timetable based on current time.
     */
    getNextClass: () => {
        const { timetable } = get();
        if (!timetable.length) return null;

        const now = new Date();
        const dayIndex = now.getDay();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // 今天剩餘的課 / Remaining classes today
        const todayRemaining = timetable
            .filter(c => c.day === dayIndex && (c.startMinute ?? 0) > currentMinutes)
            .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));

        if (todayRemaining.length) {
            return { ...todayRemaining[0], isToday: true };
        }

        // 未來幾天的第一堂課 / First class in upcoming days
        for (let offset = 1; offset <= 6; offset++) {
            const targetDay = (dayIndex + offset) % 7;
            const dayClasses = timetable
                .filter(c => c.day === targetDay)
                .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
            if (dayClasses.length) {
                return { ...dayClasses[0], isToday: false };
            }
        }

        return null;
    },
}));

export default useTimetableStore;
