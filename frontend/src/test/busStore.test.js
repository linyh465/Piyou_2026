/**
 * busStore 單元測試 / busStore Unit Tests
 * 測試公車資料 fetch、節流、手動刷新冷卻、自動輪詢
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  api: {
    get: vi.fn(),
  },
  apiError: (err, fallback) => fallback,
}));

// Mock localDb
vi.mock('../services/localDb', () => ({
  localDb: {
    getCache: vi.fn(() => Promise.resolve(null)),
    setCache: vi.fn(() => Promise.resolve()),
  },
  default: {
    getCache: vi.fn(() => Promise.resolve(null)),
    setCache: vi.fn(() => Promise.resolve()),
  },
}));

let useBusStore;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  // 重新 mock（resetModules 後需要重設）
  vi.doMock('../services/apiClient', () => ({
    api: {
      get: vi.fn(() => Promise.resolve({
        data: {
          arrivals: [
            { routeName: '300', stopName: '靜宜大學', direction: '去程', estimatedSeconds: 120, estimatedMinutes: 2, stopStatus: '2 分' },
            { routeName: '301', stopName: '靜宜大學', direction: '返程', estimatedSeconds: 60, estimatedMinutes: 1, stopStatus: '即將到站' },
          ],
          updatedAt: '12:00',
        },
      })),
    },
  }));

  const mod = await import('../stores/busStore');
  useBusStore = mod.default;
});

afterEach(() => {
  useBusStore.getState().stopAutoRefresh();
  vi.useRealTimers();
});

describe('busStore', () => {
  it('has correct initial state', () => {
    const state = useBusStore.getState();
    expect(state.arrivals).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.manualCooldown).toBe(0);
  });

  it('fetchBus updates arrivals', async () => {
    await useBusStore.getState().fetchBus();
    const state = useBusStore.getState();
    expect(state.arrivals.length).toBe(2);
    expect(state.isLoading).toBe(false);
    expect(state.arrivals[0].routeName).toBe('300');
  });

  it('manualRefresh starts cooldown', async () => {
    useBusStore.getState().manualRefresh();
    expect(useBusStore.getState().manualCooldown).toBe(60);

    // 倒數 1 秒
    vi.advanceTimersByTime(1000);
    expect(useBusStore.getState().manualCooldown).toBe(59);
  });

  it('manualRefresh is blocked during cooldown', async () => {
    useBusStore.getState().manualRefresh();
    const firstCooldown = useBusStore.getState().manualCooldown;

    // 再次呼叫 — 應被忽略
    useBusStore.getState().manualRefresh();
    expect(useBusStore.getState().manualCooldown).toBe(firstCooldown);
  });

  it('stopAutoRefresh clears intervals', () => {
    useBusStore.getState().startAutoRefresh();
    expect(useBusStore.getState()._autoInterval).not.toBeNull();

    useBusStore.getState().stopAutoRefresh();
    expect(useBusStore.getState()._autoInterval).toBeNull();
  });
});
