// Plain, readable CSV of every transaction — the one export that opens without
// this app. Built entirely on-device; the file is NOT encrypted.
import Papa from 'papaparse';
import type { Account, Category, Transaction } from '../db/repo';

export function transactionsCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): string {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  return Papa.unparse(
    {
      fields: ['Date', 'Account', 'Category', 'Amount', 'Note'],
      data: transactions.map((t) => [
        t.date,
        accountName.get(t.accountId) ?? '',
        t.transferGroupId ? 'Transfer' : (categoryName.get(t.categoryId ?? -1) ?? ''),
        (t.amount / 100).toFixed(2),
        t.note,
      ]),
    },
    // Names and notes are free text: stop spreadsheets running them as formulas.
    // A leading "-" is escaped too, except on the plain negative amounts.
    { escapeFormulae: /^[=+@\t\r]|^-(?!\d+\.\d{2}$)/ },
  );
}
