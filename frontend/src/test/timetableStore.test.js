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
      { name: '微積分', day: 1, period: 1, startMinute: 490, location: 'A101' },
      { name: '程式設計', day: 2, period: 3, startMinute: 610, location: 'B202' },
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

  it('clearTimetableData clears only timetable and token', () => {
    // 預先塞入課表與成績 / Seed timetable and grades
    sessionStorage.setItem('piyou_token', 'test-token');
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
    expect(sessionStorage.getItem('piyou_token')).toBeNull(); // token 已清除
  });

  it('clearGradesData clears only grades and token', () => {
    sessionStorage.setItem('piyou_token', 'test-token');
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
    expect(sessionStorage.getItem('piyou_token')).toBeNull(); // token 已清除
  });

  it('clearSchoolData clears data and token but preserves cooldown', () => {
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
    // 冷卻狀態不應被清除（伺服器端強制執行）/ Cooldown should NOT be cleared (server-enforced)
    expect(state.lastSyncTime).not.toBe(0); // lastSyncTime 保留
    expect(sessionStorage.getItem('piyou_token')).toBeNull();
    expect(localStorage.getItem('piyou_timetable')).toBeNull();
    expect(localStorage.getItem('piyou_grades')).toBeNull();
    // piyou_last_sync 不再被清除 / piyou_last_sync is no longer cleared
    expect(localStorage.getItem('piyou_last_sync')).not.toBeNull();
  });

  it('canSync queries server and returns cooldown status', async () => {
    // Mock 伺服器回傳冷卻中 / Mock server returning cooldown active
    mockApi.mockResolvedValueOnce({
      data: { allowed: false, reason: 'cooldown', remaining_seconds: 1800 },
    });

    const result = await useTimetableStore.getState().canSync();
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('cooldown');
    expect(result.remainingMs).toBe(1800000);
  });

  it('canSync falls back to local check on server error', async () => {
    mockApi.mockRejectedValueOnce(new Error('Network error'));

    const result = await useTimetableStore.getState().canSync();
    // 本地沒有 lastSyncTime，應允許 / No local lastSyncTime, should allow
    expect(result.allowed).toBe(true);
  });

  it('fetchTimetable discards response if data was cleared during request', async () => {
    // 模擬 in-flight 請求期間資料被清除的競態條件
    // Simulate race condition: data cleared while fetch is in-flight
    sessionStorage.setItem('piyou_token', 'test-token');

    const courses = [{ name: '微積分', day: 1, period: 1, startMinute: 490 }];
    // API 回傳會稍微延遲 / API response is delayed
    mockApi.mockImplementationOnce(() =>
      new Promise((resolve) => setTimeout(() => resolve({ data: { courses } }), 50))
    );

    const fetchPromise = useTimetableStore.getState().fetchTimetable();
    // 在請求還在飛行中時清除資料 / Clear data while request is in-flight
    useTimetableStore.getState().clearTimetableData();
    await fetchPromise;

    const state = useTimetableStore.getState();
    // 清除後不應拿到舊資料 / Should NOT get stale data after clear
    expect(state.timetable).toEqual([]);
    expect(localStorage.getItem('piyou_timetable')).toBeNull();
  });

  it('fetchGrades discards response if data was cleared during request', async () => {
    sessionStorage.setItem('piyou_token', 'test-token');

    const semesters = [{ name: '113-1', courses: [] }];
    mockApi.mockImplementationOnce(() =>
      new Promise((resolve) => setTimeout(() => resolve({ data: { semesters } }), 50))
    );

    const fetchPromise = useTimetableStore.getState().fetchGrades();
    useTimetableStore.getState().clearGradesData();
    await fetchPromise;

    const state = useTimetableStore.getState();
    expect(state.grades).toEqual([]);
    expect(localStorage.getItem('piyou_grades')).toBeNull();
  });
});
