/**
 * 交通頁面 Smoke Test / Transport Page Smoke Test
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock stores
vi.mock('../stores/themeStore', () => {
  const store = { isDarkMode: false, theme: 'light', resolvedTheme: 'light' };
  return {
    __esModule: true,
    default: Object.assign(vi.fn((selector) => (selector ? selector(store) : store)), {
      getState: () => store,
      setState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    }),
  };
});

vi.mock('../stores/busStore', () => {
  const store = {
    arrivals: [
      { routeName: '300', stopName: '靜宜大學', direction: '去程', estimatedMinutes: 3, stopStatus: '3 分', stopStatusCode: 0 },
    ],
    isLoading: false,
    error: null,
    updatedAt: '12:00',
    manualCooldown: 0,
    manualRefresh: vi.fn(),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
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

import Transport from '../pages/Transport';

describe('Transport Page', () => {
  it('renders page title', () => {
    render(
      <MemoryRouter>
        <Transport />
      </MemoryRouter>
    );
    expect(screen.getByText('公車動態')).toBeInTheDocument();
  });

  it('renders bus arrival info', () => {
    render(
      <MemoryRouter>
        <Transport />
      </MemoryRouter>
    );
    expect(screen.getByText('300')).toBeInTheDocument();
    // "靜宜大學" 出現在 header 和 arrival 列表中，用 getAllByText
    const matches = screen.getAllByText(/靜宜大學/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders filter selects', () => {
    render(
      <MemoryRouter>
        <Transport />
      </MemoryRouter>
    );
    expect(screen.getByText('即將進站')).toBeInTheDocument();
  });

  it('renders bus stops section', () => {
    render(
      <MemoryRouter>
        <Transport />
      </MemoryRouter>
    );
    expect(screen.getByText('靜宜校園周邊站牌')).toBeInTheDocument();
  });
});
