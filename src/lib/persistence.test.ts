import { afterEach, describe, expect, test, vi } from 'vitest';
import { requestPersistentStorage } from './persistence';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { storage });
}

describe('requestPersistentStorage', () => {
  test('returns false when the StorageManager API is unavailable', async () => {
    stubStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
  });

  test('short-circuits to true when already persisted, without requesting', async () => {
    const persist = vi.fn();
    stubStorage({ persisted: async () => true, persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  test('requests persistence and returns the grant result when not yet persisted', async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persisted: async () => false, persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });
});
