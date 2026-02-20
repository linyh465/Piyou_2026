/**
 * 課表與成績狀態管理 / Timetable & Grades Store
 * 呼叫後端 API 並處理 Loading、Timeout、Error 狀態
 * Calls backend API with Loading, Timeout, and Error state handling.
 */
import { create } from 'zustand';
import { api } from '../services/apiClient';

// 請求超時時間 / Request timeout duration
const REQUEST_TIMEOUT = 10000;

const useTimetableStore = create((set) => ({
    // 課表狀態 / Timetable state
    // 課表狀態 / Timetable state
    timetable: JSON.parse(localStorage.getItem('piyou_timetable') || '[]'),
    grades: JSON.parse(localStorage.getItem('piyou_grades') || '[]'),
    isLoadingTimetable: false,
    isLoadingGrades: false,
    timetableError: null,
    gradesError: null,
    isTimeout: false,

    /**
     * 取得課表 / Fetch timetable
     * 向 GET /data/timetable 發送請求，含 10 秒超時處理
     * Sends GET /data/timetable with 10s timeout handling.
     */
    fetchTimetable: async () => {
        set({ isLoadingTimetable: true, timetableError: null, isTimeout: false });

        const timeoutId = setTimeout(() => {
            set({
                isLoadingTimetable: false,
                isTimeout: true,
                timetableError: '請求逾時，請稍後再試 / Request timed out, please try again',
            });
        }, REQUEST_TIMEOUT);

        try {
            const res = await api.get('/data/timetable', { timeout: REQUEST_TIMEOUT });
            clearTimeout(timeoutId);
            const data = res.data.courses || [];
            localStorage.setItem('piyou_timetable', JSON.stringify(data));
            set({
                timetable: data,
                isLoadingTimetable: false,
                timetableError: null,
                isTimeout: false,
            });
        } catch (err) {
            clearTimeout(timeoutId);
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
        set({ isLoadingGrades: true, gradesError: null });
        try {
            const res = await api.get('/data/grades', { timeout: REQUEST_TIMEOUT });
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
        const { timetable } = useTimetableStore.getState();
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
