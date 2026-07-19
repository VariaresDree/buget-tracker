// Sync orchestration: whole-vault blob, last-writer-wins with optimistic
// concurrency. Pure of I/O — the gateway and side effects are injected, so the
// decision logic is fully unit-testable without a network or the store.

import type { KdfParams } from '../db/db';
import { decryptVault, encryptVault } from './vaultCrypto';

export interface RemoteVault {
  ciphertext: string;
  kdf: KdfParams;
  version: number;
}

export interface VaultGateway {
  fetch(): Promise<RemoteVault | null>;
  /** Push a new version; `ok: false` signals a version conflict. */
  push(row: {
    ciphertext: string;
    kdf: KdfParams;
    version: number;
    deviceId: string;
  }): Promise<{ ok: boolean }>;
}

export type SyncAction = 'push-initial' | 'pull' | 'push-update' | 'noop';

export interface SyncDeps {
  gateway: VaultGateway;
  sessionKey: CryptoKey;
  kdf: KdfParams;
  deviceId: string;
  localVersion: number;
  dirty: boolean;
  exportBackup: () => Promise<string>;
  importBackup: (json: string) => Promise<void>;
  saveSafetyBackup: (json: string) => void | Promise<void>;
  onVersion: (version: number) => void | Promise<void>;
}

export interface SyncResult {
  action: SyncAction;
  version: number;
}

/** Decide what to do given the server state and local dirty flag. */
export function decideSync(
  remote: RemoteVault | null,
  localVersion: number,
  dirty: boolean,
): SyncAction {
  if (!remote) return 'push-initial';
  if (remote.version > localVersion) return 'pull';
  if (remote.version < localVersion || dirty) return 'push-update';
  return 'noop';
}

export async function syncNow(deps: SyncDeps, retries = 1): Promise<SyncResult> {
  const remote = await deps.gateway.fetch();
  const action = decideSync(remote, deps.localVersion, deps.dirty);

  if (action === 'noop') return { action, version: deps.localVersion };

  if (action === 'pull') {
    const json = await decryptVault(deps.sessionKey, remote!.ciphertext);
    // Safety net: keep a local snapshot before the remote overwrites it.
    await deps.saveSafetyBackup(await deps.exportBackup());
    await deps.importBackup(json);
    await deps.onVersion(remote!.version);
    return { action, version: remote!.version };
  }

  // push-initial / push-update
  const base = remote ? remote.version : 0;
  const newVersion = base + 1;
  const ciphertext = await encryptVault(deps.sessionKey, await deps.exportBackup());
  const res = await deps.gateway.push({
    ciphertext,
    kdf: deps.kdf,
    version: newVersion,
    deviceId: deps.deviceId,
  });

  if (!res.ok) {
    // Another device pushed between our fetch and push. Re-run once: the fresh
    // fetch will show a newer version and we pull the winner.
    if (retries > 0) {
      return syncNow({ ...deps, localVersion: base }, retries - 1);
    }
    throw new Error('Sync conflict could not be resolved.');
  }

  await deps.onVersion(newVersion);
  return { action, version: newVersion };
}
