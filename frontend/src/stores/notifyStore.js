/**
 * 通知與回饋狀態 / Notification & Feedback Store
 * 管理公告列表、未讀追蹤、PWA 本地推播、意見回饋
 * Manages announcements, unread tracking, PWA local notifications, and feedback.
 */
import { create } from 'zustand';
import { api } from '../services/apiClient';

const ANNOUNCE_CACHE_KEY = 'piyou_announce_cache';
const READ_VERSIONS_KEY = 'piyou_read_announce_versions'; // {id: version}
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘 / 5 minutes

/**
 * 從 localStorage 讀取已讀版本 map。
 * 新格式：{id: version}（version-based re-popup 支援）
 * 舊格式向後相容：若為 array，遷移為 {id: 1}
 * Read the read-versions map from localStorage.
 * New format: {id: version}. Old array format is migrated to {id: 1}.
 */
function loadReadVersions() {
    try {
        const raw = localStorage.getItem(READ_VERSIONS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        }
        // 舊格式遷移 / Migrate old format
        const oldRaw = localStorage.getItem('piyou_read_announce_ids');
        if (oldRaw) {
            const oldIds = JSON.parse(oldRaw);
            const migrated = Object.fromEntries((Array.isArray(oldIds) ? oldIds : []).map((id) => [id, 1]));
            localStorage.setItem(READ_VERSIONS_KEY, JSON.stringify(migrated));
            localStorage.removeItem('piyou_read_announce_ids');
            return migrated;
        }
        return {};
    } catch {
        return {};
    }
}

/** 儲存已讀版本 map / Save read-versions map */
function saveReadVersions(versions) {
    localStorage.setItem(READ_VERSIONS_KEY, JSON.stringify(versions));
}

/** 判斷公告是否未讀（版本號比對）/ Check if announcement is unread (version comparison) */
function isUnread(announcement, readVersions) {
    const readVer = readVersions[announcement.id] || 0;
    return readVer < (announcement.version || 1);
}

const useNotifyStore = create((set, get) => ({
    // ── 狀態 / State ──
    announcements: [],
    unreadIds: [],
    isLoading: false,
    lastError: null,

    // ── Computed Helpers ──

    /** 未讀公告數量 / Unread announcement count */
    getUnreadCount: () => get().unreadIds.length,

    /** 是否有未讀的 urgent 公告 / Whether there are unread urgent announcements */
    getHasUrgent: () => {
        const { announcements, unreadIds } = get();
        return announcements.some(
            (a) => a.type === 'urgent' && unreadIds.includes(a.id)
        );
    },

    // ── 公告操作 / Announcement Actions ──

    /**
     * 取得公告列表（5 分鐘 TTL 前端快取）
     * Fetch announcements with 5-minute TTL cache.
     */
    fetchAnnouncements: async () => {
        // 檢查本地快取 / Check local cache
        try {
            const cached = JSON.parse(localStorage.getItem(ANNOUNCE_CACHE_KEY) || 'null');
            if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
                const readVersions = loadReadVersions();
                const unreadIds = cached.announcements
                    .filter((a) => isUnread(a, readVersions))
                    .map((a) => a.id);
                set({ announcements: cached.announcements, unreadIds });
                return;
            }
        } catch {
            // 快取損壞就重抓 / Corrupted cache, refetch
        }

        set({ isLoading: true, lastError: null });
        try {
            const res = await api.get('/notify/announcements');
            const announcements = res.data.announcements || [];

            // 計算未讀（版本號比對）/ Compute unread (version comparison)
            const readVersions = loadReadVersions();
            const unreadIds = announcements
                .filter((a) => isUnread(a, readVersions))
                .map((a) => a.id);

            // 存快取 / Store cache
            localStorage.setItem(
                ANNOUNCE_CACHE_KEY,
                JSON.stringify({ announcements, fetchedAt: Date.now() })
            );

            set({ announcements, unreadIds, isLoading: false });

            // 若有未讀 urgent 公告且使用者已授權通知，觸發本地推播
            // Trigger local notification if unread urgent and permission granted
            if (unreadIds.length > 0) {
                const hasUrgent = announcements.some(
                    (a) => a.type === 'urgent' && unreadIds.includes(a.id)
                );
                if (hasUrgent) {
                    const urgent = announcements.find(
                        (a) => a.type === 'urgent' && unreadIds.includes(a.id)
                    );
                    if (urgent) {
                        get().triggerLocalNotification(urgent.title, urgent.body);
                    }
                }
            }
        } catch (err) {
            set({ isLoading: false, lastError: err.message || '無法取得公告 / Failed to fetch announcements' });
        }
    },

    /**
     * 標記單一公告為已讀（記錄當前版本號）/ Mark single announcement as read (record current version)
     */
    markRead: (id) => {
        const { announcements } = get();
        const ann = announcements.find((a) => a.id === id);
        const version = ann?.version || 1;
        const readVersions = loadReadVersions();
        readVersions[id] = version;
        saveReadVersions(readVersions);
        set((state) => ({ unreadIds: state.unreadIds.filter((uid) => uid !== id) }));
    },

    /**
     * 標記所有公告為已讀（記錄當前版本號）/ Mark all announcements as read (record current versions)
     */
    markAllRead: () => {
        const { announcements } = get();
        const readVersions = loadReadVersions();
        announcements.forEach((a) => { readVersions[a.id] = a.version || 1; });
        saveReadVersions(readVersions);
        set({ unreadIds: [] });
    },

    /**
     * 清除公告快取（強制下次重抓）/ Invalidate cache to force refetch next time
     */
    invalidateCache: () => {
        localStorage.removeItem(ANNOUNCE_CACHE_KEY);
    },

    // ── 本地推播 / Local Push Notification ──

    /**
     * 使用 Service Worker showNotification 顯示本地通知
     * Uses SW showNotification for local notification (no server push needed).
     */
    triggerLocalNotification: async (title, body) => {
        if (
            typeof Notification === 'undefined' ||
            Notification.permission !== 'granted'
        ) {
            return;
        }
        try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(`【披呦】${title}`, {
                body: body || '',
                icon: '/pwa-192x192.png',
                badge: '/pwa-64x64.png',
                tag: 'piyou-announce',
            });
        } catch {
            // SW 推播失敗靜默忽略 / Silently ignore SW notification failure
        }
    },

    /**
     * 請求通知權限 / Request notification permission
     */
    requestNotificationPermission: async () => {
        if (typeof Notification === 'undefined') return 'unsupported';
        if (Notification.permission === 'granted') return 'granted';
        const result = await Notification.requestPermission();
        return result;
    },

    // ── 意見回饋 / Feedback ──

    /**
     * 送出匿名意見回饋 / Submit anonymous feedback
     * @param {Object} data - { category, content, contact? }
     * @returns {{ ok: boolean, id: string, error?: string }}
     */
    submitFeedback: async (data) => {
        const id = crypto.randomUUID();
        try {
            await api.post('/notify/feedback', {
                id,
                category: data.category,
                content: data.content,
                contact: data.contact || undefined,
            });
            return { ok: true, id };
        } catch (err) {
            const msg = err.response?.data?.detail || '送出失敗 / Submission failed';
            return { ok: false, id, error: msg };
        }
    },

    /**
     * 查詢回饋狀態與管理員回覆 / Query feedback status and admin reply
     * @param {string} feedbackId
     * @returns {Object|null}
     */
    getFeedbackReply: async (feedbackId) => {
        try {
            const res = await api.get(`/notify/feedback/${feedbackId}`);
            return res.data;
        } catch (err) {
            if (err.response?.status === 404) return null;
            throw err;
        }
    },
}));

export default useNotifyStore;
