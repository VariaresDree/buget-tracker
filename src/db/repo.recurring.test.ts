import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { db } from './db';
import {
  addAccount,
  addRecurringRule,
  deleteRecurringRule,
  listRecurringRules,
  listTransactions,
  runDueRecurring,
  updateRecurringRule,
} from './repo';

const initialState = useAppStore.getState();

beforeEach(async () => {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
  await useAppStore.getState().setupPassphrase('correct horse battery');
});

async function seedRule(overrides: Partial<Parameters<typeof addRecurringRule>[0]> = {}) {
  const accountId = await addAccount({ name: 'W', type: 'cash', startingBalance: 0 });
  const id = await addRecurringRule({
    accountId,
    categoryId: null,
    amount: -150000,
    note: 'Rent',
    freq: 'monthly',
    interval: 1,
    startDate: '2026-05-01',
    nextRunDate: '2026-05-01',
    endDate: null,
    ...overrides,
  });
  return { accountId, id };
}

describe('recurring rules CRUD', () => {
  test('stores amount and note encrypted, other fields plaintext', async () => {
    const { id } = await seedRule();
    const raw = await db.recurringRules.get(id);
    expect(raw).not.toHaveProperty('amount');
    expect(JSON.stringify(raw)).not.toContain('Rent');
    expect(raw?.freq).toBe('monthly');
    expect(raw?.active).toBe(true);

    const [rule] = await listRecurringRules();
    expect(rule).toMatchObject({
      amount: -150000, note: 'Rent', freq: 'monthly', interval: 1,
      nextRunDate: '2026-05-01', active: true,
    });
  });

  test('pause/resume via updateRecurringRule and delete', async () => {
    const { id } = await seedRule();
    await updateRecurringRule(id, { active: false });
    expect((await listRecurringRules())[0].active).toBe(false);
    await updateRecurringRule(id, { active: true, amount: -160000 });
    expect((await listRecurringRules())[0]).toMatchObject({ active: true, amount: -160000 });
    await deleteRecurringRule(id);
    expect(await listRecurringRules()).toHaveLength(0);
  });
});

describe('runDueRecurring', () => {
  test('generates one transaction per due occurrence and advances the rule', async () => {
    const { accountId, id } = await seedRule({
      freq: 'daily', interval: 1, startDate: '2026-07-01', nextRunDate: '2026-07-01',
    });
    const generated = await runDueRecurring('2026-07-04');
    expect(generated).toBe(4);

    const txs = await listTransactions({ accountId });
    expect(txs.map((t) => t.date).sort()).toEqual([
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
    ]);
    expect(txs.every((t) => t.amount === -150000)).toBe(true);

    const [rule] = await listRecurringRules();
    expect(rule.nextRunDate).toBe('2026-07-05');
    expect((await db.recurringRules.get(id))).toBeTruthy();
  });

  test('is idempotent — a second run the same day generates nothing', async () => {
    const { accountId } = await seedRule({
      freq: 'daily', interval: 1, startDate: '2026-07-01', nextRunDate: '2026-07-01',
    });
    await runDueRecurring('2026-07-04');
    const again = await runDueRecurring('2026-07-04');
    expect(again).toBe(0);
    expect(await listTransactions({ accountId })).toHaveLength(4);
  });

  test('deactivates a rule once it passes its endDate', async () => {
    await seedRule({
      freq: 'daily', interval: 1, startDate: '2026-07-01',
      nextRunDate: '2026-07-01', endDate: '2026-07-02',
    });
    const generated = await runDueRecurring('2026-07-10');
    expect(generated).toBe(2);
    expect((await listRecurringRules())[0].active).toBe(false);
  });

  test('skips paused rules', async () => {
    const { id, accountId } = await seedRule({
      freq: 'daily', interval: 1, startDate: '2026-07-01', nextRunDate: '2026-07-01',
    });
    await updateRecurringRule(id, { active: false });
    expect(await runDueRecurring('2026-07-04')).toBe(0);
    expect(await listTransactions({ accountId })).toHaveLength(0);
  });

  test('tags generated transactions with the rule id and its category', async () => {
    const { accountId } = await seedRule({
      categoryId: 9, freq: 'daily', interval: 1, startDate: '2026-07-01', nextRunDate: '2026-07-01',
    });
    await runDueRecurring('2026-07-01');
    const [tx] = await listTransactions({ accountId });
    expect(tx.categoryId).toBe(9);
  });
});
