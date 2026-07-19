import Dexie, { type Table } from 'dexie';
import type { Envelope } from '../crypto/envelope';

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface KdfParams {
  saltB64: string;
  iterations: number;
  hash: 'SHA-256';
}

export type AccountType = 'cash' | 'ewallet' | 'bank' | 'credit';

export type CategoryType = 'expense' | 'income';

// Stored rows: money and notes exist only as AES-GCM envelopes (🔒 in plan.md).
// Dates and foreign keys stay plaintext so indexes keep working.
export interface AccountRow {
  id?: number;
  name: string;
  type: AccountType;
  startingBalanceEnc: Envelope;
  archived: boolean;
  createdAt: number;
}

export interface CategoryRow {
  id?: number;
  name: string;
  type: CategoryType;
  monthlyCapEnc: Envelope | null; // null = no cap
  color: string;
  archived: boolean;
}

export interface TransactionRow {
  id?: number;
  date: string; // local YYYY-MM-DD
  accountId: number;
  categoryId: number | null;
  amountEnc: Envelope;
  noteEnc: Envelope;
  transferGroupId: string | null;
  recurringRuleId?: number;
  importHash?: string;
  createdAt: number;
}

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringRuleRow {
  id?: number;
  accountId: number;
  categoryId: number | null;
  amountEnc: Envelope;
  noteEnc: Envelope;
  freq: Frequency;
  interval: number;
  startDate: string;
  nextRunDate: string;
  endDate: string | null;
  active: boolean;
}

// Column mapping + format for one bank's CSV export. No financial data, so it
// is stored plaintext (behind the app lock) — only column indices and format.
export interface ImportPresetRow {
  id?: number;
  name: string;
  mapping: { date: number | null; description: number | null; amount: number | null; debit: number | null; credit: number | null };
  dateOrder: string;
  decimal: string | null;
  encoding: string;
}

export class BudgetDB extends Dexie {
  meta!: Table<MetaRow, string>;
  accounts!: Table<AccountRow, number>;
  categories!: Table<CategoryRow, number>;
  transactions!: Table<TransactionRow, number>;
  importPresets!: Table<ImportPresetRow, number>;
  recurringRules!: Table<RecurringRuleRow, number>;

  constructor() {
    super('budget-tracker');
    this.version(1).stores({
      meta: 'key',
    });
    this.version(2).stores({
      accounts: '++id, name, type',
      transactions:
        '++id, date, accountId, categoryId, [accountId+date], transferGroupId, importHash',
    });
    this.version(3).stores({
      categories: '++id, name, type',
    });
    this.version(4).stores({
      importPresets: '++id, name',
    });
    this.version(5).stores({
      recurringRules: '++id, nextRunDate, active',
    });
  }
}

export const db = new BudgetDB();
