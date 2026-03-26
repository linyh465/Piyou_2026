/**
 * 設定頁面 Smoke Test / Settings Page Smoke Test
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock stores
// Mock pushService — jsdom 沒有 serviceWorker，避免非同步副作用
vi.mock('../services/pushService', () => ({
  getPushStatus: vi.fn(async () => 'unsupported'),
  subscribePush: vi.fn(async () => true),
  unsubscribePush: vi.fn(async () => true),
}));

vi.mock('../stores/themeStore', () => {
  const store = { theme: 'system', resolvedTheme: 'light', setTheme: vi.fn(), toggle: vi.fn(), colorTheme: 'default', setColorTheme: vi.fn() };
  return {
    __esModule: true,
    COLOR_THEMES: [
      { id: 'default', label: '預設', labelEn: 'Default', description: '經典藍', color: '#007AFF' },
      { id: 'azure', label: '晴空', labelEn: 'Azure', description: '天藍澄澈', color: '#0A84FF' },
      { id: 'violet', label: '暮紫', labelEn: 'Violet', description: '幽蘭暮靄', color: '#8B5CF6' },
      { id: 'amber', label: '琥珀', labelEn: 'Amber', description: '暖陽流金', color: '#D97706' },
      { id: 'crimson', label: '緋紅', labelEn: 'Crimson', description: '丹霞映雪', color: '#DC2626' },
      { id: 'emerald', label: '翠柏', labelEn: 'Emerald', description: '蒼松斂翠', color: '#059669' },
      { id: 'rose', label: '薔薇', labelEn: 'Rose', description: '春庭薔薇', color: '#E11D48' },
      { id: 'wisteria', label: '紫櫻', labelEn: 'Wisteria', description: '幽夢花期', color: '#C026D3' },
    ],
    default: Object.assign(vi.fn((selector) => (selector ? selector(store) : store)), {
      getState: () => store,
      setState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    }),
  };
});

vi.mock('../stores/authStore', () => {
  const store = {
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
  };
  return {
    __esModule: true,
    default: Object.assign(vi.fn((selector) => (selector ? selector(store) : store)), {
      getState: () => store,
      setState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    }),
  };
});

vi.mock('../stores/timetableStore', () => {
  const store = {
    fetchTimetable: vi.fn(),
    fetchGrades: vi.fn(),
    canSync: vi.fn(async () => ({ allowed: true })),
    recordSyncSuccess: vi.fn(),
    recordSyncError: vi.fn(),
    hasCachedData: vi.fn(() => false),
    lastSyncTime: 0,
    clearSchoolData: vi.fn(),
    serverCooldown: null,
  };
  return {
    __esModule: true,
    default: Object.assign(vi.fn((selector) => (selector ? selector(store) : store)), {
      getState: () => store,
      setState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    }),
  };
});

vi.mock('../stores/libraryStore', () => {
  const store = {
    loans: [],
    reserves: [],
    history: [],
    isLoading: false,
    error: null,
    clearLibraryData: vi.fn(),
    fetchLibrary: vi.fn(),
  };
  return {
    __esModule: true,
    default: Object.assign(vi.fn((selector) => (selector ? selector(store) : store)), {
      getState: () => store,
      setState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    }),
  };
});

import Settings from '../pages/Settings';

describe('Settings Page', () => {
  it('renders page title', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText('系統設定')).toBeInTheDocument();
  });

  it('renders account section', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText('同學你好')).toBeInTheDocument();
    expect(screen.getByText('同步校園資料')).toBeInTheDocument();
  });

  it('renders theme options', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    // 主題選項為 <button> 結構（淺色 Light / 深色 Dark / 系統 System）
    expect(screen.getByRole('button', { name: /淺色/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /深色/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /系統/ })).toBeInTheDocument();
  });

  it('renders notification toggles', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText('公車到站提醒')).toBeInTheDocument();
    expect(screen.getByText('任務截止提醒')).toBeInTheDocument();
  });

  it('renders version info', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });
});
