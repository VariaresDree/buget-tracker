import Dexie, { type Table } from 'dexie';

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface KdfParams {
  saltB64: string;
  iterations: number;
  hash: 'SHA-256';
}

export class BudgetDB extends Dexie {
  meta!: Table<MetaRow, string>;

  constructor() {
    super('budget-tracker');
    this.version(1).stores({
      meta: 'key',
    });
  }
}

export const db = new BudgetDB();
