/**
 * 課表頁面 Smoke Test / Timetable Page Smoke Test
 * 驗證頁面可正常渲染，包含關鍵 UI 元素
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock timetableStore
vi.mock('../stores/timetableStore', () => {
  const store = {
    timetable: [
      { name: '微積分', day: 1, period: 1, location: 'A101' },
      { name: '程式設計', day: 2, period: 3, location: 'B202' },
    ],
    isLoadingTimetable: false,
    timetableError: null,
    isTimeout: false,
    fetchTimetable: vi.fn(),
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

import Timetable from '../pages/Timetable';

describe('Timetable Page', () => {
  it('renders page title', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    );
    expect(screen.getByText('每週課表')).toBeInTheDocument();
    expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
  });

  it('renders course names in the grid', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    );
    expect(screen.getByText('微積分')).toBeInTheDocument();
    expect(screen.getByText('程式設計')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    );
    expect(screen.getByText('重新整理')).toBeInTheDocument();
  });
});
