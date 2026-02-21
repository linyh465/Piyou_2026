/**
 * Vitest 測試全域設定 / Vitest Global Test Setup
 * 載入 @testing-library/jest-dom 擴充 matchers
 * Mock 瀏覽器缺少的 API (jsdom 不提供 matchMedia)
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia (jsdom 不支援)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock sql.js — jsdom 環境中無法載入 WASM
vi.mock('sql.js', () => ({
  default: vi.fn(() => Promise.resolve({
    Database: class {
      run() {}
      exec() { return []; }
      close() {}
    },
  })),
}));
