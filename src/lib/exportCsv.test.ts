import Papa from 'papaparse';
import { expect, test } from 'vitest';
import type { Account, Category, Transaction } from '../db/repo';
import { transactionsCsv } from './exportCsv';

const accounts: Account[] = [
  { id: 1, name: 'Wallet', type: 'cash', startingBalance: 0, archived: false, createdAt: 0 },
];
const categories: Category[] = [
  { id: 5, name: 'Food, Dining', type: 'expense', monthlyCap: null, color: '#fff', archived: false },
];
const tx = (over: Partial<Transaction>): Transaction => ({
  id: 1, date: '2026-07-10', accountId: 1, categoryId: null, amount: 0, note: '',
  transferGroupId: null, createdAt: 0, ...over,
});

test('writes readable rows with names, decimal amounts, and quoted text', () => {
  const csv = transactionsCsv(
    [
      tx({ categoryId: 5, amount: -2550, note: 'lunch "special"' }),
      tx({ amount: 500000 }),
      tx({ amount: -100000, transferGroupId: 'g1' }),
    ],
    accounts,
    categories,
  );
  expect(Papa.parse(csv).data).toEqual([
    ['Date', 'Account', 'Category', 'Amount', 'Note'],
    ['2026-07-10', 'Wallet', 'Food, Dining', '-25.50', 'lunch "special"'],
    ['2026-07-10', 'Wallet', '', '5000.00', ''],
    ['2026-07-10', 'Wallet', 'Transfer', '-1000.00', ''],
  ]);
});

test('neutralises notes a spreadsheet would run as a formula', () => {
  const csv = transactionsCsv(
    [tx({ note: '=HYPERLINK("http://x")' }), tx({ note: '-2+3' })],
    accounts,
    categories,
  );
  const notes = (Papa.parse(csv).data as string[][]).slice(1).map((r) => r[4]);
  expect(notes).toEqual(["'=HYPERLINK(\"http://x\")", "'-2+3"]);
});
