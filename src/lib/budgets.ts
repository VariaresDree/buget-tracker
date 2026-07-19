// Pure budget math over decrypted values (no crypto, no Dexie).

import { monthOf } from './dates';

interface CategoryLike {
  id: number;
  type: 'expense' | 'income';
  monthlyCap: number | null;
}

interface TxLike {
  date: string;
  amount: number;
  categoryId: number | null;
  transferGroupId: string | null;
}

export interface BudgetRow {
  categoryId: number;
  spent: number; // positive minor units
  cap: number | null;
  remaining: number | null; // cap − spent; null when no cap
  over: boolean;
}

/** Expense spend per category for one month; uncategorized under the null key. */
export function categorySpend(
  transactions: TxLike[],
  month: string,
): Map<number | null, number> {
  const spend = new Map<number | null, number>();
  for (const tx of transactions) {
    if (tx.amount >= 0 || tx.transferGroupId !== null) continue;
    if (monthOf(tx.date) !== month) continue;
    spend.set(tx.categoryId, (spend.get(tx.categoryId) ?? 0) - tx.amount);
  }
  return spend;
}

/** One row per expense category, cap compared against the month's spend. */
export function budgetRows(
  categories: CategoryLike[],
  spend: Map<number | null, number>,
): BudgetRow[] {
  return categories
    .filter((c) => c.type === 'expense')
    .map((c) => {
      const spent = spend.get(c.id) ?? 0;
      const remaining = c.monthlyCap === null ? null : c.monthlyCap - spent;
      return {
        categoryId: c.id,
        spent,
        cap: c.monthlyCap,
        remaining,
        over: remaining !== null && remaining < 0,
      };
    });
}

/** Income and expense totals (both positive) for one month, transfers excluded. */
export function monthTotals(
  transactions: TxLike[],
  month: string,
): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.transferGroupId !== null || monthOf(tx.date) !== month) continue;
    if (tx.amount >= 0) income += tx.amount;
    else expense -= tx.amount;
  }
  return { income, expense };
}
