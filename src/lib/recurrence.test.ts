import { describe, expect, test } from 'vitest';
import { computeCatchUp, nextOccurrence } from './recurrence';

describe('nextOccurrence', () => {
  test('advances daily by the interval', () => {
    expect(nextOccurrence('2026-07-01', 'daily', 1)).toBe('2026-07-02');
    expect(nextOccurrence('2026-07-01', 'daily', 3)).toBe('2026-07-04');
    expect(nextOccurrence('2026-07-31', 'daily', 1)).toBe('2026-08-01');
  });

  test('advances weekly by whole weeks', () => {
    expect(nextOccurrence('2026-07-01', 'weekly', 1)).toBe('2026-07-08');
    expect(nextOccurrence('2026-07-01', 'weekly', 2)).toBe('2026-07-15');
  });

  test('advances monthly, rolling over the year', () => {
    expect(nextOccurrence('2026-07-15', 'monthly', 1)).toBe('2026-08-15');
    expect(nextOccurrence('2026-12-15', 'monthly', 1)).toBe('2027-01-15');
  });

  test('clamps the day to the target month length', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', 1, 31)).toBe('2026-02-28');
    expect(nextOccurrence('2024-01-31', 'monthly', 1, 31)).toBe('2024-02-29');
  });

  test('preserves the anchor day after a clamped month', () => {
    // Feb 28 came from a 31st anchor; March should return to the 31st.
    expect(nextOccurrence('2026-02-28', 'monthly', 1, 31)).toBe('2026-03-31');
  });
});

describe('computeCatchUp', () => {
  test('emits one instance per due day and advances past today', () => {
    const result = computeCatchUp(
      { startDate: '2026-07-01', nextRunDate: '2026-07-01', freq: 'daily', interval: 1 },
      '2026-07-05',
    );
    expect(result.dates).toEqual([
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
    ]);
    expect(result.nextRunDate).toBe('2026-07-06');
    expect(result.deactivate).toBe(false);
  });

  test('is idempotent when the next run is still in the future', () => {
    const result = computeCatchUp(
      { startDate: '2026-07-01', nextRunDate: '2026-07-10', freq: 'daily', interval: 1 },
      '2026-07-05',
    );
    expect(result.dates).toEqual([]);
    expect(result.nextRunDate).toBe('2026-07-10');
  });

  test('stops at endDate and signals deactivation', () => {
    const result = computeCatchUp(
      { startDate: '2026-07-01', nextRunDate: '2026-07-01', freq: 'daily', interval: 1, endDate: '2026-07-03' },
      '2026-07-10',
    );
    expect(result.dates).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(result.nextRunDate).toBe('2026-07-04');
    expect(result.deactivate).toBe(true);
  });

  test('handles monthly catch-up across month-end boundaries', () => {
    const result = computeCatchUp(
      { startDate: '2026-05-31', nextRunDate: '2026-05-31', freq: 'monthly', interval: 1 },
      '2026-08-15',
    );
    expect(result.dates).toEqual(['2026-05-31', '2026-06-30', '2026-07-31']);
    expect(result.nextRunDate).toBe('2026-08-31');
    expect(result.deactivate).toBe(false);
  });
});
