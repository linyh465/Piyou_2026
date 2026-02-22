/**
 * 課表與成績狀態管理 / Timetable & Grades Store
 * 呼叫後端 API 並處理 Loading、Timeout、Error 狀態
 * Calls backend API with Loading, Timeout, and Error state handling.
 *
 * 資安：課表、成績僅快取於使用者本地端 (localStorage)，不上傳至雲端。
 * Security: timetable/grades are cached locally only, never uploaded to cloud.
 */
import { create } from 'zustand';
import { api } from '../services/apiClient';

// 請求超時時間 / Request timeout duration
const REQUEST_TIMEOUT = 25000;
const SYNC_TIMEOUT = 30000; // 同步操作允許更長時間 / Sync operations allow more time

// 同步頻率限制常數 / Sync rate limiting constants
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;         // 每 1 小時只能同步一次
const SYNC_LOCK_DURATION_MS = 15 * 60 * 1000;    // 鎖定 15 分鐘
const MAX_SYNC_ERRORS = 3;                        // 錯誤超過 3 次觸發鎖定

const useTimetableStore = create((set, get) => ({
    // 課表狀態 / Timetable state
    timetable: JSON.parse(localStorage.getItem('piyou_timetable') || '[]'),
    grades: JSON.parse(localStorage.getItem('piyou_grades') || '[]'),
    isLoadingTimetable: false,
    isLoadingGrades: false,
    timetableError: null,
    gradesError: null,
    isTimeout: false,

    // 同步限制狀態 / Sync rate limiting state
    lastSyncTime: parseInt(localStorage.getItem('piyou_last_sync') || '0', 10),
    syncErrorCount: parseInt(localStorage.getItem('piyou_sync_errors') || '0', 10),
    syncLockedUntil: parseInt(localStorage.getItem('piyou_sync_locked_until') || '0', 10),

    /** 檢查是否允許同步 / Check if sync is allowed */
    canSync: () => {
        const { lastSyncTime, syncLockedUntil } = get();
        const now = Date.now();
        if (syncLockedUntil > now) {
            return { allowed: false, reason: 'locked', remainingMs: syncLockedUntil - now };
        }
        if (lastSyncTime && (now - lastSyncTime) < SYNC_COOLDOWN_MS) {
            return { allowed: false, reason: 'cooldown', remainingMs: SYNC_COOLDOWN_MS - (now - lastSyncTime) };
        }
        return { allowed: true };
    },

    /** 記錄同步成功 / Record sync success */
    recordSyncSuccess: () => {
        const now = Date.now();
        localStorage.setItem('piyou_last_sync', String(now));
        localStorage.setItem('piyou_sync_errors', '0');
        set({ lastSyncTime: now, syncErrorCount: 0 });
    },

    /** 記錄同步錯誤，超過 3 次鎖定 15 分鐘 / Record sync error */
    recordSyncError: () => {
        const newCount = get().syncErrorCount + 1;
        if (newCount >= MAX_SYNC_ERRORS) {
            const lockUntil = Date.now() + SYNC_LOCK_DURATION_MS;
            localStorage.setItem('piyou_sync_locked_until', String(lockUntil));
            localStorage.setItem('piyou_sync_errors', '0');
            set({ syncErrorCount: 0, syncLockedUntil: lockUntil });
        } else {
            localStorage.setItem('piyou_sync_errors', String(newCount));
            set({ syncErrorCount: newCount });
        }
    },

    /** 是否有快取的校務資料 / Has cached school data */
    hasCachedData: () => {
        const { timetable, grades } = get();
        return timetable.length > 0 || grades.length > 0;
    },

    /** 清除所有校務快取資料 / Clear all cached school data */
    clearSchoolData: () => {
        localStorage.removeItem('piyou_timetable');
        localStorage.removeItem('piyou_grades');
        localStorage.removeItem('piyou_last_sync');
        sessionStorage.removeItem('piyou_token');
        set({ timetable: [], grades: [], lastSyncTime: 0 });
    },

    /** 僅清除課表快取 / Clear only timetable cache */
    clearTimetableData: () => {
        localStorage.removeItem('piyou_timetable');
        set({ timetable: [] });
    },

    /** 僅清除成績快取 / Clear only grades cache */
    clearGradesData: () => {
        localStorage.removeItem('piyou_grades');
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

        set({ isLoadingTimetable: true, timetableError: null, isTimeout: false });
        try {
            const res = await api.get('/data/timetable', { timeout: SYNC_TIMEOUT });
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

        set({ isLoadingGrades: true, gradesError: null });
        try {
            const res = await api.get('/data/grades', { timeout: SYNC_TIMEOUT });
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
        const dayIndex = now.getDay(); // 0=Sun, 1=Mon...
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const todayClasses = timetable
            .filter((c) => c.day === dayIndex)
            .sort((a, b) => a.startMinute - b.startMinute);

        // 找到今天還未開始的下一堂課 / Find next upcoming class today
        const next = todayClasses.find((c) => c.startMinute > currentMinutes);
        if (next) {
            const minutesUntil = next.startMinute - currentMinutes;
            return { ...next, minutesUntil, isToday: true };
        }

        // 若今天沒有，找明天的第一堂 / If none today, find tomorrow's first
        const tomorrowDay = (dayIndex + 1) % 7;
        const tomorrowClasses = timetable
            .filter((c) => c.day === tomorrowDay)
            .sort((a, b) => a.startMinute - b.startMinute);

        if (tomorrowClasses.length) {
            return { ...tomorrowClasses[0], minutesUntil: null, isToday: false };
        }

        return null;
    },
}));

export default useTimetableStore;
