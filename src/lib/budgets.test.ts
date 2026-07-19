import { describe, expect, test } from 'vitest';
import { budgetRows, categorySpend, monthTotals } from './budgets';

const tx = (
  date: string,
  amount: number,
  categoryId: number | null = null,
  transferGroupId: string | null = null,
) => ({ date, amount, categoryId, transferGroupId });

const cat = (id: number, type: 'expense' | 'income', monthlyCap: number | null) => ({
  id,
  type,
  monthlyCap,
});

describe('categorySpend', () => {
  test('groups expense amounts by category for the given month only', () => {
    const spend = categorySpend(
      [
        tx('2026-07-01', -1000, 1),
        tx('2026-07-31', -500, 1),
        tx('2026-06-30', -9999, 1), // previous month — excluded
        tx('2026-08-01', -9999, 1), // next month — excluded
        tx('2026-07-10', -300, 2),
      ],
      '2026-07',
    );
    expect(spend.get(1)).toBe(1500);
    expect(spend.get(2)).toBe(300);
  });

  test('keys uncategorized spend under null', () => {
    const spend = categorySpend([tx('2026-07-05', -700, null)], '2026-07');
    expect(spend.get(null)).toBe(700);
  });

  test('ignores income and transfer legs', () => {
    const spend = categorySpend(
      [
        tx('2026-07-05', 50000, 3), // income
        tx('2026-07-06', -2000, null, 'g1'), // transfer leg
        tx('2026-07-07', -100, 1),
      ],
      '2026-07',
    );
    expect(spend.get(3)).toBeUndefined();
    expect(spend.get(null)).toBeUndefined();
    expect(spend.get(1)).toBe(100);
  });
});

describe('budgetRows', () => {
  test('computes remaining against the cap', () => {
    const spend = new Map<number | null, number>([[1, 3000]]);
    const [row] = budgetRows([cat(1, 'expense', 10000)], spend);
    expect(row).toEqual({ categoryId: 1, spent: 3000, cap: 10000, remaining: 7000, over: false });
  });

  test('flags over-budget categories with negative remaining', () => {
    const spend = new Map<number | null, number>([[1, 12500]]);
    const [row] = budgetRows([cat(1, 'expense', 10000)], spend);
    expect(row.remaining).toBe(-2500);
    expect(row.over).toBe(true);
  });

  test('no-cap categories have null cap and remaining, never over', () => {
    const spend = new Map<number | null, number>([[1, 99999]]);
    const [row] = budgetRows([cat(1, 'expense', null)], spend);
    expect(row).toEqual({ categoryId: 1, spent: 99999, cap: null, remaining: null, over: false });
  });

  test('includes zero-spend capped categories and skips income categories', () => {
    const rows = budgetRows(
      [cat(1, 'expense', 5000), cat(2, 'income', null)],
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ categoryId: 1, spent: 0, remaining: 5000 });
  });
});

describe('monthTotals', () => {
  test('sums income and expenses for the month, excluding transfers', () => {
    const totals = monthTotals(
      [
        tx('2026-07-01', 50000, 3),
        tx('2026-07-02', -1500, 1),
        tx('2026-07-03', -500, null),
        tx('2026-07-04', -7777, null, 'g1'), // transfer
        tx('2026-06-30', -9999, 1), // other month
      ],
      '2026-07',
    );
    expect(totals).toEqual({ income: 50000, expense: 2000 });
  });
});
