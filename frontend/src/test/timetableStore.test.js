/**
 * timetableStore 單元測試 / timetableStore Unit Tests
 * 測試課表與成績 fetch、localStorage 快取、getNextClass
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  api: {
    get: vi.fn(),
  },
}));

let useTimetableStore;
let mockApi;

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();

  vi.doMock('../services/apiClient', () => {
    const mockGet = vi.fn();
    mockApi = mockGet;
    return { api: { get: mockGet } };
  });

  const mod = await import('../stores/timetableStore');
  useTimetableStore = mod.default;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('timetableStore', () => {
  it('has correct initial state', () => {
    const state = useTimetableStore.getState();
    expect(state.timetable).toEqual([]);
    expect(state.grades).toEqual([]);
    expect(state.isLoadingTimetable).toBe(false);
    expect(state.isLoadingGrades).toBe(false);
    expect(state.timetableError).toBeNull();
    expect(state.gradesError).toBeNull();
  });

  it('fetchTimetable stores courses and caches to localStorage', async () => {
    // 需要 token 才會實際呼叫 API / Token required to call API
    sessionStorage.setItem('piyou_token', 'test-token');
    const courses = [
      { name: '微積分', day: 1, period: 1, startMinute: 480, location: 'A101' },
      { name: '程式設計', day: 2, period: 3, startMinute: 600, location: 'B202' },
    ];
    mockApi.mockResolvedValueOnce({ data: { courses } });

    await useTimetableStore.getState().fetchTimetable();

    const state = useTimetableStore.getState();
    expect(state.timetable).toEqual(courses);
    expect(state.isLoadingTimetable).toBe(false);
    expect(state.timetableError).toBeNull();
    expect(JSON.parse(localStorage.getItem('piyou_timetable'))).toEqual(courses);
  });

  it('fetchTimetable handles errors', async () => {
    sessionStorage.setItem('piyou_token', 'test-token');
    mockApi.mockRejectedValueOnce({
      response: { status: 500, data: { detail: '伺服器錯誤' } },
    });

    await useTimetableStore.getState().fetchTimetable();

    const state = useTimetableStore.getState();
    expect(state.isLoadingTimetable).toBe(false);
    expect(state.timetableError).toBe('伺服器錯誤');
  });

  it('fetchTimetable clears error on 401 (auth expired)', async () => {
    sessionStorage.setItem('piyou_token', 'test-token');
    mockApi.mockRejectedValueOnce({
      response: { status: 401 },
    });

    await useTimetableStore.getState().fetchTimetable();

    const state = useTimetableStore.getState();
    expect(state.timetableError).toBeNull();
  });

  it('fetchGrades stores semesters', async () => {
    sessionStorage.setItem('piyou_token', 'test-token');
    const semesters = [
      { name: '113-1', courses: [{ name: '國文', score: 85, credits: 3 }] },
    ];
    mockApi.mockResolvedValueOnce({ data: { semesters } });

    await useTimetableStore.getState().fetchGrades();

    const state = useTimetableStore.getState();
    expect(state.grades).toEqual(semesters);
    expect(state.isLoadingGrades).toBe(false);
    expect(JSON.parse(localStorage.getItem('piyou_grades'))).toEqual(semesters);
  });

  it('fetchGrades handles error', async () => {
    sessionStorage.setItem('piyou_token', 'test-token');
    mockApi.mockRejectedValueOnce({
      response: { status: 500, data: { detail: '成績查詢失敗' } },
    });

    await useTimetableStore.getState().fetchGrades();

    const state = useTimetableStore.getState();
    expect(state.gradesError).toBe('成績查詢失敗');
  });

  it('getNextClass returns null when timetable is empty', () => {
    const next = useTimetableStore.getState().getNextClass();
    expect(next).toBeNull();
  });
});
