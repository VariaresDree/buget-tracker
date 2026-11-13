// Starter data for a brand-new vault: one account per type and a set of common
// categories (no monthly caps — the user sets their own budgets later). Seeding
// reuses the same addAccount/addCategory + refresh path the forms use, so the
// rest of the app needs no special handling.
import { addAccount, addCategory, type NewAccount, type NewCategory } from '../db/repo';
import { refreshAccounts } from '../hooks/useAccounts';
import { refreshCategories } from '../hooks/useCategories';
import { PRESET_COLORS } from '../components/categories/presetColors';

export const STARTER_ACCOUNTS: readonly NewAccount[] = [
  { name: 'Cash', type: 'cash', startingBalance: 0 },
  { name: 'Bank Account', type: 'bank', startingBalance: 0 },
  { name: 'E-Wallet', type: 'ewallet', startingBalance: 0 },
  { name: 'Credit Card', type: 'credit', startingBalance: 0 },
];

const EXPENSE_NAMES = [
  'Food & Dining', 'Groceries', 'Transport', 'Rent / Housing', 'Utilities',
  'Shopping', 'Health', 'Entertainment', 'Savings', 'Other',
];
const INCOME_NAMES = ['Salary', 'Other Income'];

// Colors cycle PRESET_COLORS (order is CVD-safety-significant — see presetColors).
const color = (i: number) => PRESET_COLORS[i % PRESET_COLORS.length];

export const STARTER_CATEGORIES: readonly NewCategory[] = [
  ...EXPENSE_NAMES.map((name, i) => ({
    name, type: 'expense' as const, monthlyCap: null, color: color(i),
  })),
  ...INCOME_NAMES.map((name, i) => ({
    name, type: 'income' as const, monthlyCap: null, color: color(EXPENSE_NAMES.length + i),
  })),
];

// shortcut: each row is its own Dexie transaction (non-atomic) — a mid-loop
// failure leaves partial data. Upgrade to a bulkAdd-in-one-transaction helper in
// repo.ts (like commitImport) only if partial seeds become a real problem.
export async function seedAccounts(items: readonly NewAccount[]): Promise<void> {
  if (items.length === 0) return;
  for (const item of items) await addAccount(item);
  await refreshAccounts();
}

export async function seedCategories(items: readonly NewCategory[]): Promise<void> {
  if (items.length === 0) return;
  for (const item of items) await addCategory(item);
  await refreshCategories();
}
