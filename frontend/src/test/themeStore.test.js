/**
 * themeStore 單元測試 / themeStore Unit Tests
 * 測試主題切換、localStorage 持久化、系統主題偵測
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let useThemeStore;

beforeEach(async () => {
  localStorage.clear();
  // 重新 import 取得乾淨的 store
  vi.resetModules();
  const mod = await import('../stores/themeStore');
  useThemeStore = mod.default;
});

describe('themeStore', () => {
  it('has a valid initial theme', () => {
    const state = useThemeStore.getState();
    expect(['light', 'dark', 'system']).toContain(state.theme);
    expect(['light', 'dark']).toContain(state.resolvedTheme);
  });

  it('setTheme updates theme and persists to localStorage', () => {
    useThemeStore.getState().setTheme('dark');
    const state = useThemeStore.getState();
    expect(state.theme).toBe('dark');
    expect(state.resolvedTheme).toBe('dark');
    expect(localStorage.getItem('piyou_theme')).toBe('dark');
  });

  it('toggle switches between light and dark', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');

    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');

    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
  });

  it('setTheme("system") resolves based on matchMedia', () => {
    useThemeStore.getState().setTheme('system');
    const state = useThemeStore.getState();
    expect(state.theme).toBe('system');
    // matchMedia 在 setup.js 中 mock 為 matches: false → light
    expect(state.resolvedTheme).toBe('light');
  });
});
