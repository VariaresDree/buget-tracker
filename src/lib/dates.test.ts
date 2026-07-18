import { describe, expect, test } from 'vitest';
import { monthOf, todayISO } from './dates';

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
