// The only module that reads/writes accounts and transactions. Callers pass
// and receive plaintext; envelope crypto happens here, using the session key
// (throws while the vault is locked, so nothing plaintext can ever be written).

import { decryptField, encryptField } from '../crypto/envelope';
import { getSessionKey } from '../store/useAppStore';
import type { ColumnMapping, DateOrder, DecimalStyle } from '../lib/csv/normalize';
import type { Encoding } from '../lib/csv/parse';
import {
  db,
  type AccountRow,
  type AccountType,
  type CategoryRow,
  type CategoryType,
  type ImportPresetRow,
  type TransactionRow,
} from './db';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  startingBalance: number;
  archived: boolean;
  createdAt: number;
}

export interface Transaction {
  id: number;
  date: string;
  accountId: number;
  categoryId: number | null;
  amount: number;
  note: string;
  transferGroupId: string | null;
  createdAt: number;
}

// --- accounts ---

export interface NewAccount {
  name: string;
  type: AccountType;
  startingBalance: number;
}

export async function addAccount(input: NewAccount): Promise<number> {
  const key = getSessionKey();
  return db.accounts.add({
    name: input.name,
    type: input.type,
    startingBalanceEnc: await encryptField(key, String(input.startingBalance)),
    archived: false,
    createdAt: Date.now(),
  });
}

export async function updateAccount(
  id: number,
  patch: Partial<NewAccount>,
): Promise<void> {
  const key = getSessionKey();
  const changes: Partial<AccountRow> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.type !== undefined) changes.type = patch.type;
  if (patch.startingBalance !== undefined) {
    changes.startingBalanceEnc = await encryptField(key, String(patch.startingBalance));
  }
  await db.accounts.update(id, changes);
}

/** Deletes the account, its transactions, and both legs of any transfer touching it. */
export async function deleteAccount(id: number): Promise<void> {
  getSessionKey();
  await db.transaction('rw', db.accounts, db.transactions, async () => {
    const rows = await db.transactions.where('accountId').equals(id).toArray();
    const groupIds = rows
      .map((r) => r.transferGroupId)
      .filter((g): g is string => g !== null);
    await db.transactions.where('accountId').equals(id).delete();
    if (groupIds.length > 0) {
      await db.transactions.where('transferGroupId').anyOf(groupIds).delete();
    }
    await db.accounts.delete(id);
  });
}

export async function listAccounts(): Promise<Account[]> {
  const key = getSessionKey();
  const rows = await db.accounts.toArray();
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id!,
      name: row.name,
      type: row.type,
      startingBalance: Number(await decryptField(key, row.startingBalanceEnc)),
      archived: row.archived,
      createdAt: row.createdAt,
    })),
  );
}

// --- categories ---

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  monthlyCap: number | null;
  color: string;
  archived: boolean;
}

export interface NewCategory {
  name: string;
  type: CategoryType;
  monthlyCap: number | null;
  color: string;
}

export async function addCategory(input: NewCategory): Promise<number> {
  const key = getSessionKey();
  return db.categories.add({
    name: input.name,
    type: input.type,
    monthlyCapEnc:
      input.monthlyCap === null ? null : await encryptField(key, String(input.monthlyCap)),
    color: input.color,
    archived: false,
  });
}

export async function updateCategory(
  id: number,
  patch: Partial<NewCategory>,
): Promise<void> {
  const key = getSessionKey();
  const changes: Partial<CategoryRow> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.type !== undefined) changes.type = patch.type;
  if (patch.color !== undefined) changes.color = patch.color;
  if (patch.monthlyCap !== undefined) {
    changes.monthlyCapEnc =
      patch.monthlyCap === null ? null : await encryptField(key, String(patch.monthlyCap));
  }
  await db.categories.update(id, changes);
}

/** Deletes the category; its transactions become uncategorized. */
export async function deleteCategory(id: number): Promise<void> {
  getSessionKey();
  await db.transaction('rw', db.categories, db.transactions, async () => {
    await db.transactions.where('categoryId').equals(id).modify({ categoryId: null });
    await db.categories.delete(id);
  });
}

export async function listCategories(): Promise<Category[]> {
  const key = getSessionKey();
  const rows = await db.categories.toArray();
  const categories = await Promise.all(
    rows.map(async (row) => ({
      id: row.id!,
      name: row.name,
      type: row.type,
      monthlyCap:
        row.monthlyCapEnc === null ? null : Number(await decryptField(key, row.monthlyCapEnc)),
      color: row.color,
      archived: row.archived,
    })),
  );
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

// --- transactions ---

export interface NewTransaction {
  date: string;
  accountId: number;
  categoryId?: number | null;
  amount: number;
  note?: string;
}

export async function addTransaction(input: NewTransaction): Promise<number> {
  const key = getSessionKey();
  return db.transactions.add({
    date: input.date,
    accountId: input.accountId,
    categoryId: input.categoryId ?? null,
    amountEnc: await encryptField(key, String(input.amount)),
    noteEnc: await encryptField(key, input.note ?? ''),
    transferGroupId: null,
    createdAt: Date.now(),
  });
}

export async function updateTransaction(
  id: number,
  patch: Partial<NewTransaction>,
): Promise<void> {
  const key = getSessionKey();
  const changes: Partial<TransactionRow> = {};
  if (patch.date !== undefined) changes.date = patch.date;
  if (patch.accountId !== undefined) changes.accountId = patch.accountId;
  if (patch.categoryId !== undefined) changes.categoryId = patch.categoryId;
  if (patch.amount !== undefined) {
    changes.amountEnc = await encryptField(key, String(patch.amount));
  }
  if (patch.note !== undefined) {
    changes.noteEnc = await encryptField(key, patch.note);
  }
  await db.transactions.update(id, changes);
}

/** Deleting a transfer leg deletes its counterpart too. */
export async function deleteTransaction(id: number): Promise<void> {
  getSessionKey();
  await db.transaction('rw', db.transactions, async () => {
    const row = await db.transactions.get(id);
    if (!row) return;
    if (row.transferGroupId !== null) {
      await db.transactions.where('transferGroupId').equals(row.transferGroupId).delete();
    } else {
      await db.transactions.delete(id);
    }
  });
}

export interface TransactionFilter {
  accountId?: number;
  month?: string; // YYYY-MM
}

export async function listTransactions(
  filter: TransactionFilter = {},
): Promise<Transaction[]> {
  const key = getSessionKey();
  const { accountId, month } = filter;

  let rows: TransactionRow[];
  if (accountId !== undefined && month !== undefined) {
    rows = await db.transactions
      .where('[accountId+date]')
      .between([accountId, `${month}-01`], [accountId, `${month}-99`])
      .toArray();
  } else if (accountId !== undefined) {
    rows = await db.transactions.where('accountId').equals(accountId).toArray();
  } else if (month !== undefined) {
    rows = await db.transactions.where('date').between(`${month}-01`, `${month}-99`).toArray();
  } else {
    rows = await db.transactions.toArray();
  }

  const decrypted = await Promise.all(
    rows.map(async (row) => ({
      id: row.id!,
      date: row.date,
      accountId: row.accountId,
      categoryId: row.categoryId,
      amount: Number(await decryptField(key, row.amountEnc)),
      note: await decryptField(key, row.noteEnc),
      transferGroupId: row.transferGroupId,
      createdAt: row.createdAt,
    })),
  );
  return decrypted.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || b.id - a.id,
  );
}

// --- CSV import ---

export interface ImportRow {
  date: string;
  amount: number;
  note: string;
  importHash: string;
  categoryId?: number | null;
}

/** Bulk-add imported transactions (amount/note encrypted, importHash plaintext). */
export async function commitImport(
  accountId: number,
  rows: ImportRow[],
): Promise<number> {
  const key = getSessionKey();
  const records: TransactionRow[] = await Promise.all(
    rows.map(async (row) => ({
      date: row.date,
      accountId,
      categoryId: row.categoryId ?? null,
      amountEnc: await encryptField(key, String(row.amount)),
      noteEnc: await encryptField(key, row.note),
      transferGroupId: null,
      importHash: row.importHash,
      createdAt: Date.now(),
    })),
  );
  await db.transactions.bulkAdd(records);
  return records.length;
}

/** Set of importHashes already present for an account, for dedupe. */
export async function existingImportHashes(accountId: number): Promise<Set<string>> {
  getSessionKey();
  const rows = await db.transactions.where('accountId').equals(accountId).toArray();
  const hashes = new Set<string>();
  for (const row of rows) if (row.importHash) hashes.add(row.importHash);
  return hashes;
}

// --- import presets ---

export interface ImportPreset {
  id: number;
  name: string;
  mapping: ColumnMapping;
  dateOrder: DateOrder;
  decimal: DecimalStyle | null;
  encoding: Encoding;
}

export type NewImportPreset = Omit<ImportPreset, 'id'>;

export function addImportPreset(input: NewImportPreset): Promise<number> {
  return db.importPresets.add(input as ImportPresetRow);
}

export async function listImportPresets(): Promise<ImportPreset[]> {
  const rows = await db.importPresets.toArray();
  return rows.map((row) => ({
    id: row.id!,
    name: row.name,
    mapping: row.mapping as ColumnMapping,
    dateOrder: row.dateOrder as DateOrder,
    decimal: row.decimal as DecimalStyle | null,
    encoding: row.encoding as Encoding,
  }));
}

export function deleteImportPreset(id: number): Promise<void> {
  return db.importPresets.delete(id);
}

// --- transfers ---

export interface NewTransfer {
  fromAccountId: number;
  toAccountId: number;
  amount: number; // positive minor units
  date: string;
  note?: string;
}

export async function addTransfer(input: NewTransfer): Promise<string> {
  const key = getSessionKey();
  const transferGroupId = crypto.randomUUID();
  const createdAt = Date.now();
  const noteEncOut = await encryptField(key, input.note ?? '');
  const noteEncIn = await encryptField(key, input.note ?? '');
  const outAmountEnc = await encryptField(key, String(-input.amount));
  const inAmountEnc = await encryptField(key, String(input.amount));

  await db.transaction('rw', db.transactions, async () => {
    await db.transactions.bulkAdd([
      {
        date: input.date,
        accountId: input.fromAccountId,
        categoryId: null,
        amountEnc: outAmountEnc,
        noteEnc: noteEncOut,
        transferGroupId,
        createdAt,
      },
      {
        date: input.date,
        accountId: input.toAccountId,
        categoryId: null,
        amountEnc: inAmountEnc,
        noteEnc: noteEncIn,
        transferGroupId,
        createdAt,
      },
    ]);
  });
  return transferGroupId;
}
