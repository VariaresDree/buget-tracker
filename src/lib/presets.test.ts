import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';
import { listAccounts, listCategories } from '../db/repo';
import {
  STARTER_ACCOUNTS,
  STARTER_CATEGORIES,
  seedAccounts,
  seedCategories,
} from './presets';

const initialState = useAppStore.getState();

beforeEach(async () => {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
  await useAppStore.getState().setupPassphrase('correct horse battery');
});

describe('seedAccounts', () => {
  test('inserts the selected accounts and refreshes the store cache', async () => {
    await seedAccounts(STARTER_ACCOUNTS);
    const accounts = await listAccounts();
    expect(accounts).toHaveLength(STARTER_ACCOUNTS.length);
    expect(accounts.every((a) => a.startingBalance === 0 && !a.archived)).toBe(true);
    expect(accounts.map((a) => a.type).sort()).toEqual(['bank', 'cash', 'credit', 'ewallet']);
    expect(useAppStore.getState().accounts).toHaveLength(STARTER_ACCOUNTS.length);
  });

  test('a subset seeds only the chosen rows; empty seeds nothing', async () => {
    await seedAccounts(STARTER_ACCOUNTS.slice(0, 2));
    expect(await listAccounts()).toHaveLength(2);
    await seedAccounts([]);
    expect(await listAccounts()).toHaveLength(2);
  });
});

describe('seedCategories', () => {
  test('inserts categories with blank caps and valid colors', async () => {
    await seedCategories(STARTER_CATEGORIES);
    const categories = await listCategories();
    expect(categories).toHaveLength(STARTER_CATEGORIES.length);
    expect(categories.every((c) => c.monthlyCap === null)).toBe(true);
    expect(categories.every((c) => /^#[0-9a-f]{6}$/i.test(c.color))).toBe(true);
    expect(categories.some((c) => c.type === 'income')).toBe(true);
    expect(useAppStore.getState().categories).toHaveLength(STARTER_CATEGORIES.length);
  });
});
