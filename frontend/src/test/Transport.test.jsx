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
      { routeName: '301', stopName: '靜宜大學', direction: '去程', estimatedMinutes: 3, estimatedSeconds: 180, stopStatus: '3 分', stopStatusCode: 0, stopSequence: 21 },
      { routeName: '301', stopName: '弘光科技大學', direction: '去程', estimatedMinutes: 7, estimatedSeconds: 420, stopStatus: '7 分', stopStatusCode: 0, stopSequence: 19 },
    ],
    routeStops: {
      '301': {
        '去程': [
          { stopName: '新民高中', stopSequence: 1 },
          { stopName: '弘光科技大學', stopSequence: 19 },
          { stopName: '靜宜大學', stopSequence: 21 },
          { stopName: '新光里(新福路)', stopSequence: 22 },
        ],
        '返程': [
          { stopName: '新光里(新福路)', stopSequence: 1 },
          { stopName: '靜宜大學', stopSequence: 2 },
          { stopName: '弘光科技大學', stopSequence: 4 },
          { stopName: '新民高中', stopSequence: 22 },
        ],
      },
    },
    busPositions: [],
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
    // 301 路線名稱出現在路線選擇 chip 中
    const matches301 = screen.getAllByText('301');
    expect(matches301.length).toBeGreaterThanOrEqual(1);
    // 靜宜大學出現在站牌列表
    const matchesPU = screen.getAllByText(/靜宜大學/);
    expect(matchesPU.length).toBeGreaterThanOrEqual(1);
  });

  it('renders direction tabs', () => {
    render(
      <MemoryRouter>
        <Transport />
      </MemoryRouter>
    );
    expect(screen.getByText('去程')).toBeInTheDocument();
    expect(screen.getByText('返程')).toBeInTheDocument();
  });

  it('renders route selector', () => {
    render(
      <MemoryRouter>
        <Transport />
      </MemoryRouter>
    );
    // 所有路線描述都出現在選擇器中
    const matches = screen.getAllByText(/靜宜大學/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
