// The only module that reads/writes accounts and transactions. Callers pass
// and receive plaintext; envelope crypto happens here, using the session key
// (throws while the vault is locked, so nothing plaintext can ever be written).

import {
  decryptField,
  encryptField,
  fromBase64,
  toBase64,
  type Envelope,
} from '../crypto/envelope';
import {
  createKeycheck,
  deriveKey,
  generateSalt,
  KDF_ITERATIONS,
  verifyKeycheck,
} from '../crypto/keys';
import { getSessionKey, useAppStore } from '../store/useAppStore';
import type { ColumnMapping, DateOrder, DecimalStyle } from '../lib/csv/normalize';
import type { Encoding } from '../lib/csv/parse';
import { computeCatchUp } from '../lib/recurrence';
import { todayISO } from '../lib/dates';
import {
  db,
  type AccountRow,
  type CategoryRow,
  type AccountType,
  type CategoryType,
  type Frequency,
  type ImportPresetRow,
  type KdfParams,
  type RecurringRuleRow,
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

// --- recurring rules ---

export interface RecurringRule {
  id: number;
  accountId: number;
  categoryId: number | null;
  amount: number;
  note: string;
  freq: Frequency;
  interval: number;
  startDate: string;
  nextRunDate: string;
  endDate: string | null;
  active: boolean;
}

export interface NewRecurringRule {
  accountId: number;
  categoryId: number | null;
  amount: number;
  note: string;
  freq: Frequency;
  interval: number;
  startDate: string;
  nextRunDate: string;
  endDate: string | null;
}

export async function addRecurringRule(input: NewRecurringRule): Promise<number> {
  const key = getSessionKey();
  return db.recurringRules.add({
    accountId: input.accountId,
    categoryId: input.categoryId,
    amountEnc: await encryptField(key, String(input.amount)),
    noteEnc: await encryptField(key, input.note),
    freq: input.freq,
    interval: input.interval,
    startDate: input.startDate,
    nextRunDate: input.nextRunDate,
    endDate: input.endDate,
    active: true,
  });
}

export async function updateRecurringRule(
  id: number,
  patch: Partial<NewRecurringRule & { active: boolean }>,
): Promise<void> {
  const key = getSessionKey();
  const changes: Partial<RecurringRuleRow> = {};
  for (const field of ['accountId', 'categoryId', 'freq', 'interval', 'startDate', 'nextRunDate', 'endDate', 'active'] as const) {
    if (patch[field] !== undefined) (changes as Record<string, unknown>)[field] = patch[field];
  }
  if (patch.amount !== undefined) changes.amountEnc = await encryptField(key, String(patch.amount));
  if (patch.note !== undefined) changes.noteEnc = await encryptField(key, patch.note);
  await db.recurringRules.update(id, changes);
}

export function deleteRecurringRule(id: number): Promise<void> {
  return db.recurringRules.delete(id);
}

export async function listRecurringRules(): Promise<RecurringRule[]> {
  const key = getSessionKey();
  const rows = await db.recurringRules.toArray();
  const rules = await Promise.all(
    rows.map(async (row) => ({
      id: row.id!,
      accountId: row.accountId,
      categoryId: row.categoryId,
      amount: Number(await decryptField(key, row.amountEnc)),
      note: await decryptField(key, row.noteEnc),
      freq: row.freq,
      interval: row.interval,
      startDate: row.startDate,
      nextRunDate: row.nextRunDate,
      endDate: row.endDate,
      active: row.active,
    })),
  );
  return rules.sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate));
}

/**
 * Generate any recurring transactions due on or before `today`, advancing each
 * rule's nextRunDate. Idempotent — safe to call on every unlock. Returns the
 * number of transactions created.
 */
export async function runDueRecurring(today: string = todayISO()): Promise<number> {
  const key = getSessionKey();
  const rows = (await db.recurringRules.toArray()).filter((r) => r.active);
  let created = 0;

  for (const row of rows) {
    const { dates, nextRunDate, deactivate } = computeCatchUp(
      { startDate: row.startDate, nextRunDate: row.nextRunDate, freq: row.freq, interval: row.interval, endDate: row.endDate },
      today,
    );
    if (dates.length === 0 && !deactivate) continue;

    const amount = Number(await decryptField(key, row.amountEnc));
    const note = await decryptField(key, row.noteEnc);
    const records: TransactionRow[] = await Promise.all(
      dates.map(async (date) => ({
        date,
        accountId: row.accountId,
        categoryId: row.categoryId,
        amountEnc: await encryptField(key, String(amount)),
        noteEnc: await encryptField(key, note),
        transferGroupId: null,
        recurringRuleId: row.id,
        createdAt: Date.now(),
      })),
    );
    await db.transaction('rw', db.transactions, db.recurringRules, async () => {
      if (records.length > 0) await db.transactions.bulkAdd(records);
      await db.recurringRules.update(row.id!, { nextRunDate, active: !deactivate });
    });
    created += records.length;
  }
  return created;
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

// --- encrypted backup ---

const BACKUP_FORMAT = 'budget-tracker-backup';

/**
 * Full snapshot as JSON. Financial fields stay AES-GCM envelopes, so the backup
 * is only usable with the original passphrase — the kdf params and keycheck are
 * included so the same passphrase unlocks it after a restore. No session key
 * needed: this copies raw rows without decrypting.
 */
export async function exportBackup(): Promise<string> {
  const [accounts, categories, transactions, recurringRules, importPresets, meta] =
    await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.recurringRules.toArray(),
      db.importPresets.toArray(),
      db.meta.toArray(),
    ]);
  return JSON.stringify({
    format: BACKUP_FORMAT,
    schemaVersion: db.verno, // Dexie's live schema version, not the stale meta row

    exportedAt: new Date().toISOString(),
    meta,
    tables: { accounts, categories, transactions, recurringRules, importPresets },
  });
}

/** Replace all data with a backup's contents. The app must re-lock afterward. */
export async function importBackup(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  if (parsed?.format !== BACKUP_FORMAT || !parsed.tables || !parsed.meta) {
    throw new Error('Not a valid budget-tracker backup file.');
  }
  const { accounts, categories, transactions, recurringRules, importPresets } = parsed.tables;
  await db.transaction(
    'rw',
    [db.meta, db.accounts, db.categories, db.transactions, db.recurringRules, db.importPresets],
    async () => {
      await Promise.all([
        db.meta.clear(), db.accounts.clear(), db.categories.clear(),
        db.transactions.clear(), db.recurringRules.clear(), db.importPresets.clear(),
      ]);
      await db.meta.bulkPut(parsed.meta);
      await db.accounts.bulkPut(accounts ?? []);
      await db.categories.bulkPut(categories ?? []);
      await db.transactions.bulkPut(transactions ?? []);
      await db.recurringRules.bulkPut(recurringRules ?? []);
      await db.importPresets.bulkPut(importPresets ?? []);
    },
  );
}

// --- change passphrase ---

function reEncrypt(oldKey: CryptoKey, newKey: CryptoKey, env: Envelope): Promise<Envelope> {
  return decryptField(oldKey, env).then((plain) => encryptField(newKey, plain));
}

/**
 * Re-encrypt every stored envelope under a new passphrase and swap the session
 * key. All Web Crypto runs OUTSIDE the Dexie transaction (awaiting a non-Dexie
 * promise inside one auto-commits it); only the final writes are transactional.
 */
export async function changePassphrase(
  currentPassphrase: string,
  newPassphrase: string,
): Promise<void> {
  const kdfRow = await db.meta.get('kdfParams');
  const keycheckRow = await db.meta.get('keycheck');
  if (!kdfRow || !keycheckRow) throw new Error('Vault is not initialized.');

  const kdf = kdfRow.value as KdfParams;
  const oldKey = await deriveKey(currentPassphrase, fromBase64(kdf.saltB64), kdf.iterations);
  if (!(await verifyKeycheck(oldKey, keycheckRow.value as Envelope))) {
    throw new Error('Current passphrase is incorrect.');
  }

  const newSalt = generateSalt();
  const newKey = await deriveKey(newPassphrase, newSalt);

  const [accounts, categories, transactions, rules] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.recurringRules.toArray(),
  ]);
  for (const a of accounts) a.startingBalanceEnc = await reEncrypt(oldKey, newKey, a.startingBalanceEnc);
  for (const c of categories) {
    if (c.monthlyCapEnc) c.monthlyCapEnc = await reEncrypt(oldKey, newKey, c.monthlyCapEnc);
  }
  for (const t of transactions) {
    t.amountEnc = await reEncrypt(oldKey, newKey, t.amountEnc);
    t.noteEnc = await reEncrypt(oldKey, newKey, t.noteEnc);
  }
  for (const r of rules) {
    r.amountEnc = await reEncrypt(oldKey, newKey, r.amountEnc);
    r.noteEnc = await reEncrypt(oldKey, newKey, r.noteEnc);
  }
  const newKeycheck = await createKeycheck(newKey);
  const newKdf: KdfParams = { saltB64: toBase64(newSalt), iterations: KDF_ITERATIONS, hash: 'SHA-256' };

  await db.transaction(
    'rw',
    [db.accounts, db.categories, db.transactions, db.recurringRules, db.meta],
    async () => {
      await db.accounts.bulkPut(accounts);
      await db.categories.bulkPut(categories);
      await db.transactions.bulkPut(transactions);
      await db.recurringRules.bulkPut(rules);
      await db.meta.put({ key: 'kdfParams', value: newKdf });
      await db.meta.put({ key: 'keycheck', value: newKeycheck });
    },
  );

  useAppStore.setState({ sessionKey: newKey });
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
