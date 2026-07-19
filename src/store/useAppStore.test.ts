import { beforeEach, describe, expect, test } from 'vitest';
import type { Envelope } from '../crypto/envelope';
import { db } from '../db/db';
import { getSessionKey, useAppStore } from './useAppStore';

const initialState = useAppStore.getState();

beforeEach(async () => {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
});

describe('init', () => {
  test('reports uninitialized on an empty database', async () => {
    await useAppStore.getState().init();
    expect(useAppStore.getState().lockStatus).toBe('uninitialized');
  });

  test('reports locked once a passphrase has been set up', async () => {
    await useAppStore.getState().setupPassphrase('correct horse battery');
    useAppStore.setState(initialState, true);
    await useAppStore.getState().init();
    expect(useAppStore.getState().lockStatus).toBe('locked');
    expect(useAppStore.getState().sessionKey).toBeNull();
  });
});

describe('setupPassphrase', () => {
  test('unlocks the app with a session key in memory', async () => {
    await useAppStore.getState().setupPassphrase('correct horse battery');
    const state = useAppStore.getState();
    expect(state.lockStatus).toBe('unlocked');
    expect(state.sessionKey).toBeInstanceOf(CryptoKey);
  });

  test('persists kdf params, keycheck, and default settings — never the passphrase', async () => {
    await useAppStore.getState().setupPassphrase('correct horse battery');
    const kdf = (await db.meta.get('kdfParams'))?.value as {
      saltB64: string;
      iterations: number;
    };
    expect(typeof kdf.saltB64).toBe('string');
    expect(kdf.iterations).toBeGreaterThanOrEqual(600_000);

    const keycheck = (await db.meta.get('keycheck'))?.value as Envelope;
    expect(keycheck.iv).toBeTruthy();
    expect(keycheck.ct).toBeTruthy();

    const settings = (await db.meta.get('settings'))?.value as {
      autoLockMinutes: number;
    };
    expect(settings.autoLockMinutes).toBeGreaterThan(0);

    const rows = await db.meta.toArray();
    expect(JSON.stringify(rows)).not.toContain('correct horse battery');
  });
});

describe('unlock', () => {
  test('returns true and sets the key for the correct passphrase', async () => {
    await useAppStore.getState().setupPassphrase('correct horse battery');
    useAppStore.setState(initialState, true);
    await useAppStore.getState().init();

    expect(await useAppStore.getState().unlock('correct horse battery')).toBe(true);
    expect(useAppStore.getState().lockStatus).toBe('unlocked');
    expect(useAppStore.getState().sessionKey).toBeInstanceOf(CryptoKey);
  });

  test('returns false and stays locked for a wrong passphrase', async () => {
    await useAppStore.getState().setupPassphrase('correct horse battery');
    useAppStore.setState(initialState, true);
    await useAppStore.getState().init();

    expect(await useAppStore.getState().unlock('wrong passphrase')).toBe(false);
    expect(useAppStore.getState().lockStatus).toBe('locked');
    expect(useAppStore.getState().sessionKey).toBeNull();
  });
});

describe('lockNow', () => {
  test('clears the session key and locks', async () => {
    await useAppStore.getState().setupPassphrase('correct horse battery');
    useAppStore.getState().lockNow();
    expect(useAppStore.getState().lockStatus).toBe('locked');
    expect(useAppStore.getState().sessionKey).toBeNull();
  });
});

describe('unlock runs due recurring transactions', () => {
  test('generates catch-up transactions on unlock', async () => {
    await useAppStore.getState().setupPassphrase('correct horse battery');
    const { addAccount, addRecurringRule, listTransactions } = await import('../db/repo');
    const accountId = await addAccount({ name: 'W', type: 'cash', startingBalance: 0 });
    await addRecurringRule({
      accountId, categoryId: null, amount: -1000, note: 'Daily',
      freq: 'daily', interval: 1,
      startDate: '2020-01-01', nextRunDate: '2020-01-01', endDate: '2020-01-03',
    });

    useAppStore.setState(initialState, true);
    await useAppStore.getState().init();
    await useAppStore.getState().unlock('correct horse battery');

    // 3 daily instances (Jan 1–3) generated during unlock's catch-up.
    expect(await listTransactions()).toHaveLength(3);
  });
});

describe('saveSettings', () => {
  test('persists settings and updates the store', async () => {
    await useAppStore.getState().setupPassphrase('correct horse battery');
    await useAppStore.getState().saveSettings({ currencySymbol: '$', currencyCode: 'USD' });
    expect(useAppStore.getState().settings.currencySymbol).toBe('$');

    const stored = (await db.meta.get('settings'))?.value as { currencySymbol: string };
    expect(stored.currencySymbol).toBe('$');
  });
});

describe('getSessionKey', () => {
  test('throws while locked, returns the key while unlocked', async () => {
    expect(() => getSessionKey()).toThrow();
    await useAppStore.getState().setupPassphrase('correct horse battery');
    expect(getSessionKey()).toBeInstanceOf(CryptoKey);
    useAppStore.getState().lockNow();
    expect(() => getSessionKey()).toThrow();
  });
});
