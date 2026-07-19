import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { db } from './db';
import {
  addAccount,
  addImportPreset,
  commitImport,
  deleteImportPreset,
  existingImportHashes,
  listImportPresets,
  listTransactions,
} from './repo';

const initialState = useAppStore.getState();

beforeEach(async () => {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
  await useAppStore.getState().setupPassphrase('correct horse battery');
});

describe('commitImport', () => {
  test('stores encrypted transactions with a plaintext importHash', async () => {
    const acct = await addAccount({ name: 'BPI', type: 'bank', startingBalance: 0 });
    const count = await commitImport(acct, [
      { date: '2026-07-01', amount: -350, note: 'Coffee', importHash: 'hash-a' },
      { date: '2026-07-02', amount: 500000, note: 'Salary', importHash: 'hash-b' },
    ]);
    expect(count).toBe(2);

    const raw = await db.transactions.where('importHash').equals('hash-a').first();
    expect(raw?.importHash).toBe('hash-a');
    expect(raw).not.toHaveProperty('amount');
    expect(JSON.stringify(raw)).not.toContain('Coffee');

    const txs = await listTransactions({ accountId: acct });
    expect(txs.map((t) => t.amount).sort((a, b) => a - b)).toEqual([-350, 500000]);
    expect(txs.find((t) => t.amount === -350)).toMatchObject({
      date: '2026-07-01',
      note: 'Coffee',
      categoryId: null,
    });
  });

  test('honors a per-row categoryId', async () => {
    const acct = await addAccount({ name: 'BPI', type: 'bank', startingBalance: 0 });
    await commitImport(acct, [
      { date: '2026-07-01', amount: -350, note: 'Coffee', importHash: 'h', categoryId: 7 },
    ]);
    expect((await listTransactions())[0].categoryId).toBe(7);
  });
});

describe('existingImportHashes', () => {
  test('returns the hash set for one account only', async () => {
    const a1 = await addAccount({ name: 'A1', type: 'bank', startingBalance: 0 });
    const a2 = await addAccount({ name: 'A2', type: 'bank', startingBalance: 0 });
    await commitImport(a1, [
      { date: '2026-07-01', amount: -100, note: '', importHash: 'h1' },
      { date: '2026-07-02', amount: -200, note: '', importHash: 'h2' },
    ]);
    await commitImport(a2, [{ date: '2026-07-03', amount: -300, note: '', importHash: 'h3' }]);

    const set = await existingImportHashes(a1);
    expect(set).toEqual(new Set(['h1', 'h2']));
    expect(set.has('h3')).toBe(false);
  });

  test('is empty for an account with no imports', async () => {
    const acct = await addAccount({ name: 'A', type: 'bank', startingBalance: 0 });
    expect(await existingImportHashes(acct)).toEqual(new Set());
  });
});

describe('import presets', () => {
  test('round-trips a saved per-bank mapping', async () => {
    const id = await addImportPreset({
      name: 'BPI',
      mapping: { date: 0, description: 1, amount: 2, debit: null, credit: null },
      dateOrder: 'dmy',
      decimal: 'dot',
      encoding: 'utf-8',
    });
    const presets = await listImportPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      id,
      name: 'BPI',
      dateOrder: 'dmy',
      mapping: { date: 0, description: 1, amount: 2 },
    });

    await deleteImportPreset(id);
    expect(await listImportPresets()).toHaveLength(0);
  });
});
