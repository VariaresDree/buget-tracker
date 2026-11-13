// End-to-end sync behaviour through the store, with an in-memory server.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../db/db';
import { addAccount, deleteAccount, exportBackup, listAccounts } from '../db/repo';
import { restoreSafetySnapshot } from '../lib/backupFile';
import { decryptVault, encryptVault } from '../sync/vaultCrypto';
import type { RemoteVault } from '../sync/vaultSync';
import { useAppStore } from './useAppStore';

let remote: RemoteVault | null = null;

vi.mock('../sync/client', () => ({ isSyncConfigured: () => true }));
vi.mock('../sync/auth', () => ({ currentEmail: async () => 'me@example.test' }));
vi.mock('../sync/gateway', () => ({
  supabaseGateway: () => ({
    fetch: async () => remote,
    push: async (row: RemoteVault) => {
      if (remote && row.version !== remote.version + 1) return { ok: false };
      remote = { ciphertext: row.ciphertext, kdf: row.kdf, version: row.version };
      return { ok: true };
    },
  }),
}));

const PASS = 'correct horse battery';
const initialState = useAppStore.getState();
const store = () => useAppStore.getState();
const names = async () => (await listAccounts()).map((a) => a.name).sort();

/** Simulate closing and reopening the app, then wait for the unlock-time sync. */
async function restartAndUnlock() {
  useAppStore.setState(initialState, true);
  await store().init();
  expect(await store().unlock(PASS)).toBe(true);
  await vi.waitFor(() => expect(store().lastSyncedAt).not.toBeNull());
  await vi.waitFor(() => expect(store().syncStatus).toBe('idle'));
}

beforeEach(async () => {
  remote = null;
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
  await store().setupPassphrase(PASS);
  useAppStore.setState({ syncEmail: 'me@example.test' });
});

describe('sync that replaces unsynced edits', () => {
  test('warns, keeps a snapshot, and restoring it wins the next sync', async () => {
    // This device and the server agree on [Shared].
    await addAccount({ name: 'Shared', type: 'cash', startingBalance: 0 });
    await store().runSync();
    expect(remote?.version).toBe(1);
    expect(await db.meta.get('dirty')).toBeUndefined();

    // Another device pushes [Shared, Other] as version 2.
    const other = await addAccount({ name: 'Other', type: 'bank', startingBalance: 0 });
    remote = {
      ciphertext: await encryptVault(store().sessionKey!, await exportBackup()),
      kdf: remote!.kdf,
      version: 2,
    };
    await deleteAccount(other);
    await db.meta.delete('dirty');
    useAppStore.setState({ lastSyncedEpoch: store().dataEpoch, dirtyMarked: false });

    // This device edits while offline, then the app is closed before syncing.
    await addAccount({ name: 'Mine', type: 'ewallet', startingBalance: 0 });
    await vi.waitFor(async () => expect(await db.meta.get('dirty')).toBeDefined());

    await restartAndUnlock();

    // The pull replaced the unsynced edit, said so, and kept a snapshot of it.
    expect(await names()).toEqual(['Other', 'Shared']);
    expect(store().syncReplacedEdits).toBe(true);
    const snapshot = (await db.meta.get('sync-safety'))?.value as { json: string };
    expect(snapshot.json).toContain('"Mine"');
    // Snapshots never nest inside backups or the synced blob.
    expect(await exportBackup()).not.toContain('sync-safety');

    // Undo: this device's data comes back and is uploaded on the next sync.
    await restoreSafetySnapshot();
    expect(store().lockStatus).toBe('locked');
    await restartAndUnlock();
    expect(await names()).toEqual(['Mine', 'Shared']);
    expect(remote?.version).toBe(3);
    const pushed = await decryptVault(store().sessionKey!, remote!.ciphertext);
    expect(pushed).toContain('"Mine"');
    expect(pushed).not.toContain('"Other"');
    expect(store().syncReplacedEdits).toBe(false);
  });

  test('a pull with nothing unsynced stays quiet', async () => {
    await addAccount({ name: 'Shared', type: 'cash', startingBalance: 0 });
    await store().runSync();
    remote = { ...remote!, version: 2 };

    await restartAndUnlock();

    expect(store().syncVersion).toBe(2);
    expect(store().syncReplacedEdits).toBe(false);
  });

  test('unsynced edits from a previous session are pushed after a restart', async () => {
    await addAccount({ name: 'Shared', type: 'cash', startingBalance: 0 });
    await store().runSync();
    await addAccount({ name: 'Offline edit', type: 'cash', startingBalance: 0 });
    await vi.waitFor(async () => expect(await db.meta.get('dirty')).toBeDefined());

    await restartAndUnlock();

    expect(remote?.version).toBe(2);
    expect(await decryptVault(store().sessionKey!, remote!.ciphertext)).toContain('Offline edit');
  });
});
