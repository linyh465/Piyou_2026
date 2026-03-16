/**
 * 成績頁面 Smoke Test / Grades Page Smoke Test
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock timetableStore (Grades uses the same store)
vi.mock('../stores/timetableStore', () => {
  const store = {
    grades: [
      {
        name: '113-1 上學期',
        class_rank: 5,
        class_total: 60,
        dept_rank: 12,
        dept_total: 120,
        courses: [
          { name: '微積分', score: 92, credits: 3 },
          { name: '國文', score: 78, credits: 2 },
          { name: '體育', score_text: '通過', credits: 0 },
        ],
      },
    ],
    isLoadingGrades: false,
    gradesError: null,
    clearGradesData: vi.fn(),
    canSync: vi.fn().mockResolvedValue({ allowed: true }),
    fetchGrades: vi.fn(),
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

import Grades from '../pages/Grades';

describe('Grades Page', () => {
  it('renders page title', () => {
    render(
      <MemoryRouter>
        <Grades />
      </MemoryRouter>
    );
    expect(screen.getByText('成績查詢')).toBeInTheDocument();
  });

  it('renders semester name', () => {
    render(
      <MemoryRouter>
        <Grades />
      </MemoryRouter>
    );
    expect(screen.getByText('113-1 上學期')).toBeInTheDocument();
  });

  it('renders course names and scores', () => {
    render(
      <MemoryRouter>
        <Grades />
      </MemoryRouter>
    );
    expect(screen.getByText('微積分')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('國文')).toBeInTheDocument();
    expect(screen.getByText('通過')).toBeInTheDocument();
  });

  it('displays GPA badge', () => {
    render(
      <MemoryRouter>
        <Grades />
      </MemoryRouter>
    );
    // GPA 會根據分數計算（92→4.3, 78→3.3），加權平均
    const gpaBadges = screen.getAllByText(/GPA/);
    expect(gpaBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('displays class rank and dept rank', () => {
    render(
      <MemoryRouter>
        <Grades />
      </MemoryRouter>
    );
    expect(screen.getAllByText('班級排名').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('系所排名').length).toBeGreaterThanOrEqual(1);
  });
});
