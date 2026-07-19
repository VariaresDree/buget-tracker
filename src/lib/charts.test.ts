import { describe, expect, test } from 'vitest';
import {
  cumulativeSpendSeries,
  OTHER_COLOR,
  pieData,
  UNCATEGORIZED_COLOR,
} from './charts';

const cat = (id: number, name: string, color: string) => ({ id, name, color });

const tx = (
  date: string,
  amount: number,
  transferGroupId: string | null = null,
) => ({ date, amount, categoryId: null, transferGroupId });

describe('pieData', () => {
  test('maps categories to named slices sorted by value desc', () => {
    const slices = pieData(
      [cat(1, 'Food', '#3987e5'), cat(2, 'Transport', '#199e70')],
      new Map([
        [1, 1500],
        [2, 4000],
      ]),
    );
    expect(slices).toEqual([
      { name: 'Transport', value: 4000, color: '#199e70' },
      { name: 'Food', value: 1500, color: '#3987e5' },
    ]);
  });

  test('labels null-key spend as Uncategorized', () => {
    const slices = pieData([], new Map([[null, 700]]));
    expect(slices).toEqual([
      { name: 'Uncategorized', value: 700, color: UNCATEGORIZED_COLOR },
    ]);
  });

  test('folds slices beyond the limit into Other', () => {
    const categories = [1, 2, 3, 4, 5, 6, 7, 8].map((i) =>
      cat(i, `Cat${i}`, `#00000${i}`),
    );
    const spend = new Map<number | null, number>(
      categories.map((c) => [c.id, c.id * 100]),
    );
    const slices = pieData(categories, spend, { maxSlices: 6 });
    expect(slices).toHaveLength(6);
    // Top 5 by value are Cat8..Cat4; Cat3+Cat2+Cat1 fold into Other (600).
    expect(slices[0]).toMatchObject({ name: 'Cat8', value: 800 });
    expect(slices[4]).toMatchObject({ name: 'Cat4', value: 400 });
    expect(slices[5]).toEqual({ name: 'Other', value: 600, color: OTHER_COLOR });
  });

  test('returns empty for no spend', () => {
    expect(pieData([cat(1, 'Food', '#3987e5')], new Map())).toEqual([]);
  });
});

describe('cumulativeSpendSeries', () => {
  test('accumulates daily expenses across the month, carrying quiet days forward', () => {
    const series = cumulativeSpendSeries(
      [tx('2026-07-01', -1000), tx('2026-07-03', -500), tx('2026-07-03', -500)],
      '2026-07',
    );
    expect(series).toHaveLength(31);
    expect(series[0]).toEqual({ day: 1, total: 1000 });
    expect(series[1]).toEqual({ day: 2, total: 1000 });
    expect(series[2]).toEqual({ day: 3, total: 2000 });
    expect(series[30]).toEqual({ day: 31, total: 2000 });
  });

  test('ignores income, transfers, and other months', () => {
    const series = cumulativeSpendSeries(
      [
        tx('2026-07-05', -1000),
        tx('2026-07-06', 99900), // income
        tx('2026-07-07', -7777, 'g1'), // transfer leg
        tx('2026-06-30', -5555), // other month
      ],
      '2026-07',
    );
    expect(series[30].total).toBe(1000);
  });

  test('truncates at throughDay for the current month', () => {
    const series = cumulativeSpendSeries([tx('2026-07-02', -300)], '2026-07', 10);
    expect(series).toHaveLength(10);
    expect(series[9]).toEqual({ day: 10, total: 300 });
  });

  test('returns an all-zero series when there is no spend', () => {
    const series = cumulativeSpendSeries([], '2026-02');
    expect(series).toHaveLength(28);
    expect(series.every((p) => p.total === 0)).toBe(true);
  });
});
