/**
 * 任務頁面 Smoke Test / Tasks Page Smoke Test
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock taskStore
vi.mock('../stores/taskStore', () => {
  const store = {
    tasks: [
      { id: '1', title: '完成作業', completed: false, category: 'homework', priority: 1, description: '數學習題' },
      { id: '2', title: '複習考試', completed: true, category: 'exam', priority: 2 },
    ],
    isLoading: false,
    filter: 'all',
    categoryFilter: 'all',
    loadTasks: vi.fn(),
    getFilteredTasks: vi.fn(() => [
      { id: '1', title: '完成作業', completed: false, category: 'homework', priority: 1, description: '數學習題' },
      { id: '2', title: '複習考試', completed: true, category: 'exam', priority: 2 },
    ]),
    setFilter: vi.fn(),
    exportToMarkdown: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    toggleTask: vi.fn(),
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

import Tasks from '../pages/Tasks';

describe('Tasks Page', () => {
  it('renders page title', () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );
    expect(screen.getByText('任務管理')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('renders task items', () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );
    expect(screen.getByText('完成作業')).toBeInTheDocument();
    expect(screen.getByText('複習考試')).toBeInTheDocument();
  });

  it('renders filter buttons', () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );
    expect(screen.getByText('全部 All')).toBeInTheDocument();
    expect(screen.getByText('進行中 Active')).toBeInTheDocument();
    expect(screen.getByText('已完成 Done')).toBeInTheDocument();
  });

  it('renders new task and export buttons', () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );
    expect(screen.getByText('新增任務')).toBeInTheDocument();
    expect(screen.getByText('MD')).toBeInTheDocument();
  });
});
