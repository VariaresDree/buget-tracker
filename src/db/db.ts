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

export class BudgetDB extends Dexie {
  meta!: Table<MetaRow, string>;
  accounts!: Table<AccountRow, number>;
  transactions!: Table<TransactionRow, number>;

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
  }
}

export const db = new BudgetDB();
