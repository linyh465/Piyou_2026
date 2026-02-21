/**
 * dashboardStore 單元測試 / dashboardStore Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/apiClient', () => ({
  api: { get: vi.fn() },
}));

let useDashboardStore;
let useTimetableStore;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();

  vi.doMock('../services/apiClient', () => ({
    api: { get: vi.fn() },
  }));

  const ttMod = await import('../stores/timetableStore');
  useTimetableStore = ttMod.default;

  const dashMod = await import('../stores/dashboardStore');
  useDashboardStore = dashMod.default;
});

describe('dashboardStore', () => {
  it('getNextClass delegates to timetableStore', () => {
    // 空課表 → null
    const result = useDashboardStore.getState().getNextClass();
    expect(result).toBeNull();
  });

  it('getNextClass returns course when timetable has data', () => {
    const now = new Date();
    const dayIndex = now.getDay();
    const futureMinute = now.getHours() * 60 + now.getMinutes() + 60;

    useTimetableStore.setState({
      timetable: [
        { name: '測試課程', day: dayIndex, period: 5, startMinute: futureMinute, location: 'A101' },
      ],
    });

    const result = useDashboardStore.getState().getNextClass();
    if (dayIndex >= 1 && dayIndex <= 6 && futureMinute < 1440) {
      expect(result).not.toBeNull();
      expect(result.name).toBe('測試課程');
      expect(result.isToday).toBe(true);
    }
    // 週日時 dayIndex=0，可能沒有結果 — 這也是正確行為
  });
});
