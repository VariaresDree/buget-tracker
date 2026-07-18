import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { db } from './db';
import {
  addAccount,
  addTransaction,
  addTransfer,
  deleteAccount,
  deleteTransaction,
  listAccounts,
  listTransactions,
  updateAccount,
  updateTransaction,
} from './repo';

const initialState = useAppStore.getState();

beforeEach(async () => {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
  await useAppStore.getState().setupPassphrase('correct horse battery');
});

describe('accounts', () => {
  test('stores the starting balance as an envelope, never plaintext', async () => {
    const id = await addAccount({ name: 'GCash', type: 'ewallet', startingBalance: 123456 });
    const raw = await db.accounts.get(id);
    expect(raw).not.toHaveProperty('startingBalance');
    expect(typeof raw?.startingBalanceEnc.iv).toBe('string');
    expect(typeof raw?.startingBalanceEnc.ct).toBe('string');
  });

  test('round-trips accounts through listAccounts', async () => {
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 50000 });
    await addAccount({ name: 'BPI', type: 'bank', startingBalance: 1000000 });
    const accounts = await listAccounts();
    expect(accounts).toHaveLength(2);
    const wallet = accounts.find((a) => a.name === 'Wallet');
    expect(wallet).toMatchObject({ type: 'cash', startingBalance: 50000, archived: false });
    expect(typeof wallet?.id).toBe('number');
  });

  test('updateAccount re-encrypts a changed starting balance', async () => {
    const id = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 100 });
    await updateAccount(id, { name: 'Cash Wallet', startingBalance: 999 });
    const [account] = await listAccounts();
    expect(account).toMatchObject({ name: 'Cash Wallet', startingBalance: 999 });
  });

  test('deleteAccount cascades its transactions and transfer counterpart legs', async () => {
    const a1 = await addAccount({ name: 'A1', type: 'cash', startingBalance: 0 });
    const a2 = await addAccount({ name: 'A2', type: 'bank', startingBalance: 0 });
    await addTransaction({ date: '2026-07-01', accountId: a1, amount: -500 });
    await addTransaction({ date: '2026-07-02', accountId: a2, amount: -700 });
    await addTransfer({ fromAccountId: a1, toAccountId: a2, amount: 1000, date: '2026-07-03' });

    await deleteAccount(a1);

    expect(await listAccounts()).toHaveLength(1);
    const remaining = await listTransactions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ accountId: a2, amount: -700 });
  });
});

describe('transactions', () => {
  test('stores amount and note as envelopes, never plaintext', async () => {
    const acct = await addAccount({ name: 'W', type: 'cash', startingBalance: 0 });
    const id = await addTransaction({
      date: '2026-07-10',
      accountId: acct,
      amount: -2500,
      note: 'secret lunch spot',
    });
    const raw = await db.transactions.get(id);
    expect(raw).not.toHaveProperty('amount');
    expect(raw).not.toHaveProperty('note');
    expect(JSON.stringify(raw)).not.toContain('secret lunch spot');
    expect(typeof raw?.amountEnc.ct).toBe('string');
    expect(typeof raw?.noteEnc.ct).toBe('string');
  });

  test('round-trips amount and note through listTransactions', async () => {
    const acct = await addAccount({ name: 'W', type: 'cash', startingBalance: 0 });
    await addTransaction({ date: '2026-07-10', accountId: acct, amount: -2500, note: 'lunch' });
    const [tx] = await listTransactions();
    expect(tx).toMatchObject({
      date: '2026-07-10',
      accountId: acct,
      categoryId: null,
      amount: -2500,
      note: 'lunch',
      transferGroupId: null,
    });
  });

  test('sorts by date descending and filters by account and month', async () => {
    const a1 = await addAccount({ name: 'A1', type: 'cash', startingBalance: 0 });
    const a2 = await addAccount({ name: 'A2', type: 'bank', startingBalance: 0 });
    await addTransaction({ date: '2026-06-30', accountId: a1, amount: -100 });
    await addTransaction({ date: '2026-07-05', accountId: a1, amount: -200 });
    await addTransaction({ date: '2026-07-20', accountId: a2, amount: -300 });

    const all = await listTransactions();
    expect(all.map((t) => t.date)).toEqual(['2026-07-20', '2026-07-05', '2026-06-30']);

    const forA1 = await listTransactions({ accountId: a1 });
    expect(forA1.map((t) => t.amount)).toEqual([-200, -100]);

    const july = await listTransactions({ month: '2026-07' });
    expect(july.map((t) => t.amount)).toEqual([-300, -200]);

    const julyA1 = await listTransactions({ accountId: a1, month: '2026-07' });
    expect(julyA1.map((t) => t.amount)).toEqual([-200]);
  });

  test('updateTransaction re-encrypts changed fields', async () => {
    const acct = await addAccount({ name: 'W', type: 'cash', startingBalance: 0 });
    const id = await addTransaction({ date: '2026-07-10', accountId: acct, amount: -100, note: 'a' });
    await updateTransaction(id, { amount: -900, note: 'groceries', date: '2026-07-11' });
    const [tx] = await listTransactions();
    expect(tx).toMatchObject({ amount: -900, note: 'groceries', date: '2026-07-11' });
  });
});

describe('transfers', () => {
  test('creates two linked legs with opposite amounts and no category', async () => {
    const a1 = await addAccount({ name: 'A1', type: 'cash', startingBalance: 0 });
    const a2 = await addAccount({ name: 'A2', type: 'ewallet', startingBalance: 0 });
    await addTransfer({ fromAccountId: a1, toAccountId: a2, amount: 3000, date: '2026-07-15', note: 'top-up' });

    const txs = await listTransactions();
    expect(txs).toHaveLength(2);
    const out = txs.find((t) => t.accountId === a1);
    const into = txs.find((t) => t.accountId === a2);
    expect(out).toMatchObject({ amount: -3000, categoryId: null, note: 'top-up' });
    expect(into).toMatchObject({ amount: 3000, categoryId: null, note: 'top-up' });
    expect(out?.transferGroupId).toBeTruthy();
    expect(out?.transferGroupId).toBe(into?.transferGroupId);
  });

  test('deleting one leg deletes both', async () => {
    const a1 = await addAccount({ name: 'A1', type: 'cash', startingBalance: 0 });
    const a2 = await addAccount({ name: 'A2', type: 'ewallet', startingBalance: 0 });
    await addTransfer({ fromAccountId: a1, toAccountId: a2, amount: 3000, date: '2026-07-15' });
    const [leg] = await listTransactions();
    await deleteTransaction(leg.id);
    expect(await listTransactions()).toHaveLength(0);
  });
});

describe('locked vault', () => {
  test('repo operations reject instead of writing plaintext', async () => {
    useAppStore.getState().lockNow();
    await expect(
      addAccount({ name: 'W', type: 'cash', startingBalance: 0 }),
    ).rejects.toThrow(/locked/i);
  });
});
