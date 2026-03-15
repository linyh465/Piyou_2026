/**
 * 玩課雲狀態管理 / WoW Class (TronClass) Store
 * 抓取待辦作業，支援忽略功能，本地快取
 * Fetches pending assignments, supports ignore feature, local cache.
 */
import { create } from 'zustand';
import { api } from '../services/apiClient';

const CACHE_KEY = 'piyou_tronclass';
const IGNORED_KEY = 'piyou_tronclass_ignored';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分鐘

function loadCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed._cached_at) return null;
        if (Date.now() - parsed._cached_at > CACHE_TTL_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, _cached_at: Date.now() }));
    } catch { /* storage full — ignore */ }
}

function loadIgnoredIds() {
    try {
        const raw = localStorage.getItem(IGNORED_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveIgnoredIds(ids) {
    try {
        localStorage.setItem(IGNORED_KEY, JSON.stringify([...ids]));
    } catch { /* ignore */ }
}

const useTronclassStore = create((set, get) => ({
    // ── 狀態 / State ──
    assignments: [],       // 全部作業（含忽略）
    isLoading: false,
    error: null,
    fetchedAt: null,
    ignoredIds: loadIgnoredIds(),   // Set<string>

    /**
     * 取得可見作業（未忽略）/ Get visible assignments (not ignored)
     */
    getVisible: () => {
        const { assignments, ignoredIds } = get();
        return assignments.filter((a) => !ignoredIds.has(a.id));
    },

    /**
     * 取得已忽略作業 / Get ignored assignments
     */
    getIgnored: () => {
        const { assignments, ignoredIds } = get();
        return assignments.filter((a) => ignoredIds.has(a.id));
    },

    /**
     * 載入作業（優先本地快取）/ Load assignments (cache-first)
     */
    fetchAssignments: async (forceRefresh = false) => {
        const token = sessionStorage.getItem('piyou_token');
        if (!token) return;

        // 先讀快取 / Try cache first
        if (!forceRefresh) {
            const cached = loadCache();
            if (cached && cached.assignments) {
                set({ assignments: cached.assignments, fetchedAt: cached.fetched_at || null });
                return;
            }
        }

        set({ isLoading: true, error: null });
        try {
            const res = await api.get('/data/tronclass', { timeout: 30000 });
            const data = res.data;
            const assignments = data.assignments || [];
            saveCache(data);
            set({
                assignments,
                fetchedAt: data.fetched_at || new Date().toISOString(),
                isLoading: false,
                error: null,
            });
        } catch (err) {
            const msg = err.response?.data?.detail || '無法取得玩課雲資料';
            set({ isLoading: false, error: msg });
        }
    },

    /**
     * 強制重新同步 / Force refresh from server
     */
    refresh: () => {
        localStorage.removeItem(CACHE_KEY);
        return get().fetchAssignments(true);
    },

    /**
     * 忽略作業（首頁隱藏）/ Ignore assignment (hide from dashboard)
     */
    ignoreAssignment: (id) => {
        const newIds = new Set(get().ignoredIds);
        newIds.add(id);
        saveIgnoredIds(newIds);
        set({ ignoredIds: newIds });
    },

    /**
     * 取消忽略 / Unignore assignment
     */
    unignoreAssignment: (id) => {
        const newIds = new Set(get().ignoredIds);
        newIds.delete(id);
        saveIgnoredIds(newIds);
        set({ ignoredIds: newIds });
    },
}));

export default useTronclassStore;
