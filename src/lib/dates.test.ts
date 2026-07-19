import { describe, expect, test } from 'vitest';
import { addMonths, monthOf, todayISO } from './dates';

describe('todayISO', () => {
  test('returns the local date as YYYY-MM-DD', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(todayISO()).toBe(expected);
  });
});

describe('monthOf', () => {
  test('extracts YYYY-MM from an ISO date', () => {
    expect(monthOf('2026-07-18')).toBe('2026-07');
  });
});

describe('addMonths', () => {
  test('steps months including year boundaries', () => {
    expect(addMonths('2026-07', -1)).toBe('2026-06');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-07', 0)).toBe('2026-07');
  });
});
