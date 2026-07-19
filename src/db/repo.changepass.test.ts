import { beforeEach, describe, expect, test } from 'vitest';
import { deriveKey, verifyKeycheck } from '../crypto/keys';
import type { Envelope } from '../crypto/envelope';
import { fromBase64 } from '../crypto/envelope';
import { useAppStore } from '../store/useAppStore';
import { db, type KdfParams } from './db';
import {
  addAccount,
  addCategory,
  addRecurringRule,
  addTransaction,
  changePassphrase,
  listAccounts,
  listCategories,
  listRecurringRules,
  listTransactions,
} from './repo';

const initialState = useAppStore.getState();
const OLD = 'correct horse battery';
const NEW = 'a brand new passphrase';

beforeEach(async () => {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
  await useAppStore.getState().setupPassphrase(OLD);
});

async function seedData() {
  const acct = await addAccount({ name: 'BPI', type: 'bank', startingBalance: 500000 });
  const cat = await addCategory({ name: 'Food', type: 'expense', monthlyCap: 300000, color: '#3987e5' });
  await addTransaction({ date: '2026-07-01', accountId: acct, amount: -2500, note: 'Lunch', categoryId: cat });
  await addRecurringRule({
    accountId: acct, categoryId: cat, amount: -150000, note: 'Rent',
    freq: 'monthly', interval: 1, startDate: '2026-08-01', nextRunDate: '2026-08-01', endDate: null,
  });
  return { acct, cat };
}

describe('changePassphrase', () => {
  test('rewrites kdf params with a fresh salt and a new keycheck', async () => {
    const oldKdf = (await db.meta.get('kdfParams'))?.value as KdfParams;
    await changePassphrase(OLD, NEW);
    const newKdf = (await db.meta.get('kdfParams'))?.value as KdfParams;
    expect(newKdf.saltB64).not.toBe(oldKdf.saltB64);

    const keycheck = (await db.meta.get('keycheck'))?.value as Envelope;
    const newKey = await deriveKey(NEW, fromBase64(newKdf.saltB64), newKdf.iterations);
    expect(await verifyKeycheck(newKey, keycheck)).toBe(true);
    const oldKey = await deriveKey(OLD, fromBase64(newKdf.saltB64), newKdf.iterations);
    expect(await verifyKeycheck(oldKey, keycheck)).toBe(false);
  });

  test('re-encrypts all data so it still decrypts, values unchanged', async () => {
    await seedData();
    await changePassphrase(OLD, NEW);

    // Session key is now the new key, so the repo readers use it.
    expect((await listAccounts())[0]).toMatchObject({ name: 'BPI', startingBalance: 500000 });
    expect((await listCategories())[0]).toMatchObject({ name: 'Food', monthlyCap: 300000 });
    expect((await listTransactions())[0]).toMatchObject({ amount: -2500, note: 'Lunch' });
    expect((await listRecurringRules())[0]).toMatchObject({ amount: -150000, note: 'Rent' });
  });

  test('leaves null category caps as null', async () => {
    await addCategory({ name: 'Misc', type: 'expense', monthlyCap: null, color: '#999999' });
    await changePassphrase(OLD, NEW);
    expect((await listCategories())[0].monthlyCap).toBeNull();
  });

  test('the old passphrase no longer unlocks; the new one does', async () => {
    await seedData();
    await changePassphrase(OLD, NEW);

    useAppStore.setState(initialState, true);
    await useAppStore.getState().init();
    expect(await useAppStore.getState().unlock(OLD)).toBe(false);
    expect(await useAppStore.getState().unlock(NEW)).toBe(true);
  });

  test('rejects a wrong current passphrase and changes nothing', async () => {
    const before = (await db.meta.get('kdfParams'))?.value as KdfParams;
    await expect(changePassphrase('wrong current', NEW)).rejects.toThrow(/passphrase/i);
    const after = (await db.meta.get('kdfParams'))?.value as KdfParams;
    expect(after.saltB64).toBe(before.saltB64);
  });

  test('updates the in-memory session key so writes keep working', async () => {
    const { acct } = await seedData();
    await changePassphrase(OLD, NEW);
    // A write after the change encrypts under the new key and reads back fine.
    await addTransaction({ date: '2026-07-02', accountId: acct, amount: -999, note: 'After' });
    expect((await listTransactions()).some((t) => t.note === 'After' && t.amount === -999)).toBe(true);
  });
});
