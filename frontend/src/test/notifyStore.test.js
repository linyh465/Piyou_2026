/**
 * notifyStore 單元測試 / notifyStore Unit Tests
 * - markRead() 更新 unreadIds
 * - markAllRead() 清空 unreadIds
 * - fetchAnnouncements() 快取邏輯
 * - getUnreadCount() / getHasUrgent() computed helpers
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock apiClient 讓 notifyStore 不發出真實 HTTP 請求
vi.mock('../services/apiClient', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
    },
    apiError: (err, fallback) => fallback,
}));

import { api } from '../services/apiClient';
import useNotifyStore from '../stores/notifyStore';

const SAMPLE_ANNOUNCEMENTS = [
    {
        id: 'ann_2',
        title: '系統維護公告',
        body: '今晚 23:00 進行系統維護',
        type: 'warning',
        target: 'all',
        published_at: '2026-03-01T00:00:00+00:00',
        expires_at: null,
        link_url: null,
        link_label: null,
        version: 1,
    },
    {
        id: 'ann_3',
        title: '緊急公告',
        body: '請注意！',
        type: 'urgent',
        target: 'all',
        published_at: '2026-03-10T00:00:00+00:00',
        expires_at: null,
        link_url: null,
        link_label: null,
        version: 2,
    },
];

beforeEach(() => {
    // 重置 Zustand store / Reset Zustand store
    useNotifyStore.setState({
        announcements: [],
        unreadIds: [],
        isLoading: false,
        lastError: null,
    });
    // 清除 localStorage / Clear localStorage
    localStorage.clear();
    // 清除 sessionStorage（確保 session-fetch 標記重置）/ Clear sessionStorage
    sessionStorage.clear();
    // 重置 vi mocks / Reset vi mocks
    vi.clearAllMocks();
});

describe('markRead()', () => {
    it('從 unreadIds 移除指定 ID / removes specified id from unreadIds', () => {
        useNotifyStore.setState({
            announcements: SAMPLE_ANNOUNCEMENTS,
            unreadIds: ['ann_2', 'ann_3'],
        });

        useNotifyStore.getState().markRead('ann_2');

        const { unreadIds } = useNotifyStore.getState();
        expect(unreadIds).not.toContain('ann_2');
        expect(unreadIds).toContain('ann_3');
    });

    it('markRead 同時寫入 localStorage（version-based）', () => {
        useNotifyStore.setState({
            announcements: SAMPLE_ANNOUNCEMENTS,
            unreadIds: ['ann_2'],
        });
        useNotifyStore.getState().markRead('ann_2');

        const stored = JSON.parse(localStorage.getItem('piyou_read_announce_versions') || '{}');
        expect(stored['ann_2']).toBe(1); // version of ann_2 is 1
    });
});

describe('markAllRead()', () => {
    it('清空 unreadIds / clears all unreadIds', () => {
        useNotifyStore.setState({
            announcements: SAMPLE_ANNOUNCEMENTS,
            unreadIds: ['ann_2', 'ann_3'],
        });

        useNotifyStore.getState().markAllRead();

        expect(useNotifyStore.getState().unreadIds).toHaveLength(0);
    });

    it('markAllRead 將所有版本號存入 localStorage', () => {
        useNotifyStore.setState({
            announcements: SAMPLE_ANNOUNCEMENTS,
            unreadIds: ['ann_2', 'ann_3'],
        });

        useNotifyStore.getState().markAllRead();

        const stored = JSON.parse(localStorage.getItem('piyou_read_announce_versions') || '{}');
        expect(stored['ann_2']).toBe(1); // version of ann_2
        expect(stored['ann_3']).toBe(2); // version of ann_3
    });
});

describe('getUnreadCount()', () => {
    it('回傳正確的未讀數量 / returns correct unread count', () => {
        useNotifyStore.setState({ unreadIds: ['ann_2', 'ann_3'] });
        expect(useNotifyStore.getState().getUnreadCount()).toBe(2);
    });

    it('無未讀時回傳 0 / returns 0 when no unread', () => {
        useNotifyStore.setState({ unreadIds: [] });
        expect(useNotifyStore.getState().getUnreadCount()).toBe(0);
    });
});

describe('getHasUrgent()', () => {
    it('有未讀 urgent 公告時回傳 true', () => {
        useNotifyStore.setState({
            announcements: SAMPLE_ANNOUNCEMENTS,
            unreadIds: ['ann_3'], // ann_3 is urgent
        });
        expect(useNotifyStore.getState().getHasUrgent()).toBe(true);
    });

    it('urgent 公告已讀時回傳 false', () => {
        useNotifyStore.setState({
            announcements: SAMPLE_ANNOUNCEMENTS,
            unreadIds: ['ann_2'], // ann_2 is warning, not urgent
        });
        expect(useNotifyStore.getState().getHasUrgent()).toBe(false);
    });
});

describe('fetchAnnouncements() 快取邏輯 / cache logic', () => {
    it('命中有效快取時不呼叫 API / uses cache when valid, no API call', async () => {
        // 模擬本 session 已完成首次請求，後續應走快取
        // Simulate first fetch already done this session, subsequent calls use cache
        sessionStorage.setItem('piyou_ann_session_fetched', '1');
        // 預先填入快取 / Pre-fill cache
        const cachedData = {
            announcements: SAMPLE_ANNOUNCEMENTS,
            fetchedAt: Date.now(), // 剛剛快取，未過期
        };
        localStorage.setItem('piyou_announce_cache', JSON.stringify(cachedData));

        await useNotifyStore.getState().fetchAnnouncements();

        expect(api.get).not.toHaveBeenCalled();
        expect(useNotifyStore.getState().announcements).toHaveLength(2);
    });

    it('快取過期時呼叫 API / calls API when cache is expired', async () => {
        // 過期的快取 / Expired cache
        const expiredCache = {
            announcements: [],
            fetchedAt: Date.now() - 10 * 60 * 1000, // 10 分鐘前
        };
        localStorage.setItem('piyou_announce_cache', JSON.stringify(expiredCache));

        api.get.mockResolvedValueOnce({
            data: { announcements: SAMPLE_ANNOUNCEMENTS, fetched_at: new Date().toISOString() },
        });

        await useNotifyStore.getState().fetchAnnouncements();

        expect(api.get).toHaveBeenCalledWith('/notify/announcements');
        expect(useNotifyStore.getState().announcements).toHaveLength(2);
    });

    it('API 失敗時設定 lastError / sets lastError on API failure', async () => {
        localStorage.removeItem('piyou_announce_cache');
        api.get.mockRejectedValueOnce(new Error('Network error'));

        await useNotifyStore.getState().fetchAnnouncements();

        expect(useNotifyStore.getState().lastError).not.toBeNull();
        expect(useNotifyStore.getState().isLoading).toBe(false);
    });
});
