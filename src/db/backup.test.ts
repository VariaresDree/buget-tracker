import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { db } from './db';
import {
  addAccount,
  addCategory,
  addTransaction,
  exportBackup,
  importBackup,
  listAccounts,
  listCategories,
  listTransactions,
} from './repo';

const initialState = useAppStore.getState();

async function freshVault(passphrase = 'correct horse battery') {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
  await useAppStore.getState().setupPassphrase(passphrase);
}

beforeEach(() => freshVault());

describe('backup export/import', () => {
  test('exports a versioned JSON snapshot of all tables', async () => {
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 10000 });
    const json = await exportBackup();
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe('budget-tracker-backup');
    expect(parsed.schemaVersion).toBeGreaterThanOrEqual(4);
    expect(parsed.tables.accounts).toHaveLength(1);
    expect(parsed.meta.some((m: { key: string }) => m.key === 'kdfParams')).toBe(true);
    // Amounts are still envelopes in the backup, never plaintext.
    expect(json).not.toContain('"10000"');
  });

  test('restores data decryptable with the original passphrase', async () => {
    const acct = await addAccount({ name: 'BPI', type: 'bank', startingBalance: 500000 });
    const cat = await addCategory({ name: 'Food', type: 'expense', monthlyCap: 300000, color: '#3987e5' });
    await addTransaction({ date: '2026-07-01', accountId: acct, amount: -2500, note: 'Lunch', categoryId: cat });
    const json = await exportBackup();

    // Wipe and set up a *different* vault, then restore the backup over it.
    await freshVault('a totally different passphrase');
    await importBackup(json);

    // The restored keycheck belongs to the original passphrase.
    useAppStore.setState(initialState, true);
    await useAppStore.getState().init();
    expect(await useAppStore.getState().unlock('a totally different passphrase')).toBe(false);
    expect(await useAppStore.getState().unlock('correct horse battery')).toBe(true);

    expect((await listAccounts())[0]).toMatchObject({ name: 'BPI', startingBalance: 500000 });
    expect((await listCategories())[0]).toMatchObject({ name: 'Food', monthlyCap: 300000 });
    expect((await listTransactions())[0]).toMatchObject({ amount: -2500, note: 'Lunch' });
  });

  test('rejects a file that is not a budget-tracker backup', async () => {
    await expect(importBackup('{"format":"something-else"}')).rejects.toThrow(/backup/i);
    await expect(importBackup('not json at all')).rejects.toThrow();
  });
});
