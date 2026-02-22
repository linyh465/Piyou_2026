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

  it('clearTimetableData clears only timetable', () => {
    // 預先塞入課表與成績 / Seed timetable and grades
    localStorage.setItem('piyou_timetable', JSON.stringify([{ name: '微積分' }]));
    localStorage.setItem('piyou_grades', JSON.stringify([{ name: '113-1' }]));
    useTimetableStore.setState({
      timetable: [{ name: '微積分' }],
      grades: [{ name: '113-1' }],
    });

    useTimetableStore.getState().clearTimetableData();

    const state = useTimetableStore.getState();
    expect(state.timetable).toEqual([]);
    expect(state.grades).toEqual([{ name: '113-1' }]); // 成績不受影響
    expect(localStorage.getItem('piyou_timetable')).toBeNull();
    expect(localStorage.getItem('piyou_grades')).not.toBeNull();
  });

  it('clearGradesData clears only grades', () => {
    localStorage.setItem('piyou_timetable', JSON.stringify([{ name: '微積分' }]));
    localStorage.setItem('piyou_grades', JSON.stringify([{ name: '113-1' }]));
    useTimetableStore.setState({
      timetable: [{ name: '微積分' }],
      grades: [{ name: '113-1' }],
    });

    useTimetableStore.getState().clearGradesData();

    const state = useTimetableStore.getState();
    expect(state.grades).toEqual([]);
    expect(state.timetable).toEqual([{ name: '微積分' }]); // 課表不受影響
    expect(localStorage.getItem('piyou_grades')).toBeNull();
    expect(localStorage.getItem('piyou_timetable')).not.toBeNull();
  });

  it('clearSchoolData clears all data and token', () => {
    sessionStorage.setItem('piyou_token', 'test-token');
    localStorage.setItem('piyou_timetable', JSON.stringify([{ name: '微積分' }]));
    localStorage.setItem('piyou_grades', JSON.stringify([{ name: '113-1' }]));
    localStorage.setItem('piyou_last_sync', String(Date.now()));
    useTimetableStore.setState({
      timetable: [{ name: '微積分' }],
      grades: [{ name: '113-1' }],
      lastSyncTime: Date.now(),
    });

    useTimetableStore.getState().clearSchoolData();

    const state = useTimetableStore.getState();
    expect(state.timetable).toEqual([]);
    expect(state.grades).toEqual([]);
    expect(state.lastSyncTime).toBe(0);
    expect(sessionStorage.getItem('piyou_token')).toBeNull();
    expect(localStorage.getItem('piyou_timetable')).toBeNull();
    expect(localStorage.getItem('piyou_grades')).toBeNull();
    expect(localStorage.getItem('piyou_last_sync')).toBeNull();
  });
});
