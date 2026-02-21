/**
 * 設定頁面 Smoke Test / Settings Page Smoke Test
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock stores
vi.mock('../stores/themeStore', () => {
  const store = { theme: 'system', resolvedTheme: 'light', setTheme: vi.fn(), toggle: vi.fn() };
  return {
    __esModule: true,
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
  const store = { fetchTimetable: vi.fn(), fetchGrades: vi.fn() };
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
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders account section', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText('同學你好')).toBeInTheDocument();
    expect(screen.getByText('同步校務資料')).toBeInTheDocument();
  });

  it('renders theme options', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText('淺色 Light')).toBeInTheDocument();
    expect(screen.getByText('深色 Dark')).toBeInTheDocument();
    expect(screen.getByText('系統 System')).toBeInTheDocument();
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
    expect(screen.getByText('1.0.0-beta')).toBeInTheDocument();
  });
});
