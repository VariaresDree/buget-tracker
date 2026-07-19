import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { KdfParams } from '../db/db';
import { encryptVault } from './vaultCrypto';
import {
  decideSync,
  syncNow,
  type RemoteVault,
  type SyncDeps,
  type VaultGateway,
} from './vaultSync';

const KDF: KdfParams = { saltB64: 'c2FsdA==', iterations: 600000, hash: 'SHA-256' };

function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** In-memory server enforcing optimistic concurrency by version. */
function fakeGateway(initial: RemoteVault | null = null): VaultGateway & { row: RemoteVault | null } {
  return {
    row: initial,
    async fetch() {
      return this.row;
    },
    async push(r) {
      const base = this.row?.version ?? 0;
      if (r.version !== base + 1) return { ok: false };
      this.row = { ciphertext: r.ciphertext, kdf: r.kdf, version: r.version };
      return { ok: true };
    },
  };
}

describe('decideSync', () => {
  test('push-initial when the server has no row', () => {
    expect(decideSync(null, 0, false)).toBe('push-initial');
  });
  test('pull when the server is ahead', () => {
    expect(decideSync({ ciphertext: '', kdf: KDF, version: 5 }, 3, false)).toBe('pull');
  });
  test('push-update when local is dirty at the same version', () => {
    expect(decideSync({ ciphertext: '', kdf: KDF, version: 3 }, 3, true)).toBe('push-update');
  });
  test('noop when clean and in sync', () => {
    expect(decideSync({ ciphertext: '', kdf: KDF, version: 3 }, 3, false)).toBe('noop');
  });
});

describe('syncNow', () => {
  let key: CryptoKey;
  let deps: SyncDeps;
  let onVersion: ReturnType<typeof vi.fn>;
  let importBackup: ReturnType<typeof vi.fn>;
  let saveSafetyBackup: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    key = await makeKey();
    onVersion = vi.fn();
    importBackup = vi.fn();
    saveSafetyBackup = vi.fn();
    deps = {
      gateway: fakeGateway(),
      sessionKey: key,
      kdf: KDF,
      deviceId: 'dev-A',
      localVersion: 0,
      dirty: true,
      exportBackup: vi.fn(async () => JSON.stringify({ tables: { accounts: [] } })),
      importBackup,
      saveSafetyBackup,
      onVersion,
    };
  });

  test('pushes the initial vault to an empty server', async () => {
    const gw = deps.gateway as ReturnType<typeof fakeGateway>;
    const result = await syncNow(deps);
    expect(result).toEqual({ action: 'push-initial', version: 1 });
    expect(gw.row?.version).toBe(1);
    expect(onVersion).toHaveBeenCalledWith(1);
  });

  test('pushes an update when dirty and in sync', async () => {
    const gw = fakeGateway({ ciphertext: 'x', kdf: KDF, version: 4 });
    const result = await syncNow({ ...deps, gateway: gw, localVersion: 4, dirty: true });
    expect(result).toEqual({ action: 'push-update', version: 5 });
    expect(gw.row?.version).toBe(5);
  });

  test('does nothing when clean and in sync', async () => {
    const gw = fakeGateway({ ciphertext: 'x', kdf: KDF, version: 4 });
    const result = await syncNow({ ...deps, gateway: gw, localVersion: 4, dirty: false });
    expect(result.action).toBe('noop');
    expect(onVersion).not.toHaveBeenCalled();
  });

  test('pulls and imports when the server is ahead, backing up first', async () => {
    const remoteJson = JSON.stringify({ tables: { accounts: ['remote'] } });
    const gw = fakeGateway({ ciphertext: await encryptVault(key, remoteJson), kdf: KDF, version: 9 });
    const result = await syncNow({ ...deps, gateway: gw, localVersion: 2, dirty: true });

    expect(result).toEqual({ action: 'pull', version: 9 });
    expect(saveSafetyBackup).toHaveBeenCalledBefore(importBackup);
    expect(importBackup).toHaveBeenCalledWith(remoteJson);
    expect(onVersion).toHaveBeenCalledWith(9);
  });

  test('recovers from a push conflict by pulling the winning version', async () => {
    // Server jumps to a newer version between our fetch and push.
    const remoteJson = JSON.stringify({ tables: { accounts: ['winner'] } });
    let fetched = false;
    const gw: VaultGateway = {
      async fetch() {
        if (!fetched) {
          fetched = true;
          return { ciphertext: 'stale', kdf: KDF, version: 4 };
        }
        return { ciphertext: await encryptVault(key, remoteJson), kdf: KDF, version: 5 };
      },
      async push() {
        return { ok: false }; // conflict
      },
    };
    const result = await syncNow({ ...deps, gateway: gw, localVersion: 4, dirty: true });
    expect(result.action).toBe('pull');
    expect(importBackup).toHaveBeenCalledWith(remoteJson);
  });
});
