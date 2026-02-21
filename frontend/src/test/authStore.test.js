/**
 * authStore 單元測試 / authStore Unit Tests
 * 測試 Zustand store 的初始狀態與登出邏輯
 */
import { describe, it, expect, beforeEach } from 'vitest';

// 動態重置 store，避免測試之間互相污染
let useAuthStore;

beforeEach(async () => {
  // 重新 import 以取得乾淨的 store
  const mod = await import('../stores/authStore');
  useAuthStore = mod.default;
  // 確保是登出狀態
  useAuthStore.getState().logout?.();
});

describe('authStore', () => {
  it('has the correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('logout clears auth state', async () => {
    // 手動設定一些狀態
    useAuthStore.setState({
      token: 'test-token',
      user: { name: 'Test' },
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });
});
