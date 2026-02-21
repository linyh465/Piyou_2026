/**
 * taskStore 單元測試 / taskStore Unit Tests
 * 測試任務 CRUD、篩選邏輯、Markdown 匯出
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localDb
const mockTasks = [];
vi.mock('../services/localDb', () => ({
  default: {
    getAllTasks: vi.fn(() => Promise.resolve([...mockTasks])),
    createTask: vi.fn((task) => {
      mockTasks.push({ id: 'test-id', ...task, completed: false });
      return Promise.resolve('test-id');
    }),
    updateTask: vi.fn((id, updates) => {
      const idx = mockTasks.findIndex(t => t.id === id);
      if (idx >= 0) Object.assign(mockTasks[idx], updates);
      return Promise.resolve();
    }),
    deleteTask: vi.fn((id) => {
      const idx = mockTasks.findIndex(t => t.id === id);
      if (idx >= 0) mockTasks.splice(idx, 1);
      return Promise.resolve();
    }),
    toggleTask: vi.fn((id) => {
      const idx = mockTasks.findIndex(t => t.id === id);
      if (idx >= 0) mockTasks[idx].completed = !mockTasks[idx].completed;
      return Promise.resolve();
    }),
  },
  localDb: {
    getCache: vi.fn(() => Promise.resolve(null)),
    setCache: vi.fn(() => Promise.resolve()),
  },
}));

// Mock exportMarkdown
vi.mock('../utils/exportMarkdown', () => ({
  downloadMarkdown: vi.fn(),
}));

let useTaskStore;

beforeEach(async () => {
  mockTasks.length = 0;
  vi.resetModules();

  // 重新 mock localDb
  vi.doMock('../services/localDb', () => ({
    default: {
      getAllTasks: vi.fn(() => Promise.resolve([...mockTasks])),
      createTask: vi.fn((task) => {
        mockTasks.push({ id: `id-${mockTasks.length}`, ...task, completed: false });
        return Promise.resolve(`id-${mockTasks.length - 1}`);
      }),
      updateTask: vi.fn((id, updates) => {
        const idx = mockTasks.findIndex(t => t.id === id);
        if (idx >= 0) Object.assign(mockTasks[idx], updates);
        return Promise.resolve();
      }),
      deleteTask: vi.fn((id) => {
        const idx = mockTasks.findIndex(t => t.id === id);
        if (idx >= 0) mockTasks.splice(idx, 1);
        return Promise.resolve();
      }),
      toggleTask: vi.fn((id) => {
        const idx = mockTasks.findIndex(t => t.id === id);
        if (idx >= 0) mockTasks[idx].completed = !mockTasks[idx].completed;
        return Promise.resolve();
      }),
    },
    localDb: {
      getCache: vi.fn(() => Promise.resolve(null)),
      setCache: vi.fn(() => Promise.resolve()),
    },
  }));

  vi.doMock('../utils/exportMarkdown', () => ({
    downloadMarkdown: vi.fn(),
  }));

  const mod = await import('../stores/taskStore');
  useTaskStore = mod.default;
});

describe('taskStore', () => {
  it('has correct initial state', () => {
    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.filter).toBe('all');
    expect(state.categoryFilter).toBe('all');
  });

  it('loadTasks populates store from localDb', async () => {
    mockTasks.push(
      { id: '1', title: 'Task A', completed: false, category: 'general', priority: 0 },
      { id: '2', title: 'Task B', completed: true, category: 'homework', priority: 1 },
    );
    await useTaskStore.getState().loadTasks();
    expect(useTaskStore.getState().tasks.length).toBe(2);
  });

  it('setFilter / setCategoryFilter updates state', () => {
    useTaskStore.getState().setFilter('active');
    expect(useTaskStore.getState().filter).toBe('active');

    useTaskStore.getState().setCategoryFilter('exam');
    expect(useTaskStore.getState().categoryFilter).toBe('exam');
  });

  it('getFilteredTasks filters by status', () => {
    useTaskStore.setState({
      tasks: [
        { id: '1', title: 'A', completed: false, category: 'general' },
        { id: '2', title: 'B', completed: true, category: 'general' },
      ],
    });

    useTaskStore.getState().setFilter('active');
    expect(useTaskStore.getState().getFilteredTasks().length).toBe(1);
    expect(useTaskStore.getState().getFilteredTasks()[0].title).toBe('A');

    useTaskStore.getState().setFilter('completed');
    expect(useTaskStore.getState().getFilteredTasks().length).toBe(1);
    expect(useTaskStore.getState().getFilteredTasks()[0].title).toBe('B');
  });

  it('getFilteredTasks filters by category', () => {
    useTaskStore.setState({
      tasks: [
        { id: '1', title: 'A', completed: false, category: 'homework' },
        { id: '2', title: 'B', completed: false, category: 'exam' },
      ],
      filter: 'all',
    });

    useTaskStore.getState().setCategoryFilter('homework');
    const filtered = useTaskStore.getState().getFilteredTasks();
    expect(filtered.length).toBe(1);
    expect(filtered[0].category).toBe('homework');
  });
});
