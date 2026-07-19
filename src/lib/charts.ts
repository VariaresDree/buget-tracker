// Pure chart-data transforms (no crypto, no Dexie, no Recharts).

import { daysInMonth, monthOf } from './dates';

// Neutral grays for the two synthetic slices; real categories carry their own
// user-chosen color, which follows the category everywhere it appears.
export const UNCATEGORIZED_COLOR = '#8b94a8';
export const OTHER_COLOR = '#5c6478';

export interface PieSlice {
  name: string;
  value: number;
  color: string;
}

interface CategoryLike {
  id: number;
  name: string;
  color: string;
}

const DEFAULT_MAX_SLICES = 6;

/**
 * Month's expense spend as pie slices, sorted descending. Spend beyond
 * `maxSlices` folds into a single "Other" slice — a pie stays readable only
 * with a handful of slices.
 */
export function pieData(
  categories: CategoryLike[],
  spend: Map<number | null, number>,
  opts: { maxSlices?: number } = {},
): PieSlice[] {
  const maxSlices = opts.maxSlices ?? DEFAULT_MAX_SLICES;
  const byId = new Map(categories.map((c) => [c.id, c]));

  const slices: PieSlice[] = [];
  for (const [categoryId, value] of spend) {
    if (value <= 0) continue;
    if (categoryId === null) {
      slices.push({ name: 'Uncategorized', value, color: UNCATEGORIZED_COLOR });
    } else {
      const category = byId.get(categoryId);
      if (category) {
        slices.push({ name: category.name, value, color: category.color });
      }
    }
  }
  slices.sort((a, b) => b.value - a.value);

  if (slices.length > maxSlices) {
    const folded = slices.splice(maxSlices - 1);
    slices.push({
      name: 'Other',
      value: folded.reduce((sum, s) => sum + s.value, 0),
      color: OTHER_COLOR,
    });
  }
  return slices;
}

export interface SpendPoint {
  day: number;
  total: number;
}

/**
 * Cumulative expense total per day of `month` (transfers and income excluded).
 * `throughDay` truncates the series — pass today's day-of-month when charting
 * the current month so the line ends at "now" instead of flatlining ahead.
 */
export function cumulativeSpendSeries(
  transactions: {
    date: string;
    amount: number;
    transferGroupId: string | null;
  }[],
  month: string,
  throughDay: number = daysInMonth(month),
): SpendPoint[] {
  const perDay = new Array<number>(daysInMonth(month) + 1).fill(0);
  for (const tx of transactions) {
    if (tx.amount >= 0 || tx.transferGroupId !== null) continue;
    if (monthOf(tx.date) !== month) continue;
    perDay[Number(tx.date.slice(8, 10))] -= tx.amount;
  }

  const series: SpendPoint[] = [];
  let total = 0;
  for (let day = 1; day <= throughDay; day++) {
    total += perDay[day];
    series.push({ day, total });
  }
  return series;
}
