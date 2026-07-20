import { create } from 'zustand';
import { fromBase64, toBase64, type Envelope } from '../crypto/envelope';
import {
  createKeycheck,
  deriveKey,
  generateSalt,
  KDF_ITERATIONS,
  verifyKeycheck,
} from '../crypto/keys';
import { db, type KdfParams } from '../db/db';
// Type-only import: repo.ts imports getSessionKey from this module at runtime,
// so the runtime dependency must stay one-directional (repo → store).
import type { Account, Category } from '../db/repo';

export interface Settings {
  currencyCode: string;
  currencySymbol: string;
  theme: 'light' | 'dark' | 'system';
  autoLockMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  currencyCode: 'PHP',
  currencySymbol: '₱',
  theme: 'system',
  autoLockMinutes: 5,
};

export type LockStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export type TabId =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'more'
  | 'recurring'
  | 'import'
  | 'settings';

interface AppState {
  lockStatus: LockStatus;
  sessionKey: CryptoKey | null;
  settings: Settings;
  /** Decrypted caches; null = not loaded. Wiped on lock. */
  accounts: Account[] | null;
  categories: Category[] | null;
  activeTab: TabId;
  // --- sync slice ---
  syncEmail: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  syncVersion: number; // last reconciled server version
  dataEpoch: number; // bumped on every local write
  lastSyncedEpoch: number; // dataEpoch captured at last successful sync
  init: () => Promise<void>;
  setupPassphrase: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  lockNow: () => void;
  setAccounts: (accounts: Account[]) => void;
  setCategories: (categories: Category[]) => void;
  setActiveTab: (tab: TabId) => void;
  /** Set by the quick-add FAB; the transactions screen consumes and clears it. */
  pendingQuickAdd: boolean;
  requestQuickAdd: () => void;
  clearQuickAdd: () => void;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  touchData: () => void;
  refreshSyncEmail: () => Promise<void>;
  runSync: () => Promise<void>;
  restoreFromSync: (email: string, password: string, passphrase: string) => Promise<void>;
}

export const useAppStore = create<AppState>()((set) => ({
  lockStatus: 'loading',
  sessionKey: null,
  settings: DEFAULT_SETTINGS,
  accounts: null,
  categories: null,
  activeTab: 'dashboard',
  pendingQuickAdd: false,
  syncEmail: null,
  syncStatus: 'idle',
  lastSyncedAt: null,
  syncVersion: 0,
  dataEpoch: 0,
  lastSyncedEpoch: 0,

  async init() {
    const [kdf, settingsRow] = await Promise.all([
      db.meta.get('kdfParams'),
      db.meta.get('settings'),
    ]);
    // Load persisted settings (plaintext in meta) so the theme is right on the
    // lock screen, before any passphrase is entered.
    set({
      lockStatus: kdf ? 'locked' : 'uninitialized',
      settings: (settingsRow?.value as Settings) ?? DEFAULT_SETTINGS,
    });
  },

  async setupPassphrase(passphrase) {
    const salt = generateSalt();
    const key = await deriveKey(passphrase, salt);
    const keycheck = await createKeycheck(key);
    const kdfParams: KdfParams = {
      saltB64: toBase64(salt),
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    };
    await db.meta.bulkPut([
      { key: 'kdfParams', value: kdfParams },
      { key: 'keycheck', value: keycheck },
      { key: 'settings', value: DEFAULT_SETTINGS },
      { key: 'schemaVersion', value: 1 },
    ]);
    set({ sessionKey: key, lockStatus: 'unlocked', settings: DEFAULT_SETTINGS });
  },

  async unlock(passphrase) {
    const kdfRow = await db.meta.get('kdfParams');
    const keycheckRow = await db.meta.get('keycheck');
    if (!kdfRow || !keycheckRow) return false;

    const kdf = kdfRow.value as KdfParams;
    const key = await deriveKey(passphrase, fromBase64(kdf.saltB64), kdf.iterations);
    if (!(await verifyKeycheck(key, keycheckRow.value as Envelope))) {
      return false;
    }

    const settingsRow = await db.meta.get('settings');
    set({
      sessionKey: key,
      lockStatus: 'unlocked',
      settings: (settingsRow?.value as Settings) ?? DEFAULT_SETTINGS,
    });

    // Auto-log any recurring transactions that came due while away. Dynamic
    // import keeps the store→repo dependency one-directional at module load.
    const { runDueRecurring } = await import('../db/repo');
    await runDueRecurring();

    // Load sync bookkeeping; treat freshly-unlocked state as clean.
    const syncRow = await db.meta.get('sync');
    const syncVersion = (syncRow?.value as { version: number } | undefined)?.version ?? 0;
    set({ syncVersion, lastSyncedEpoch: useAppStore.getState().dataEpoch });
    // Pull any updates made on other devices (non-blocking, offline-safe).
    void useAppStore.getState().refreshSyncEmail().then(() => useAppStore.getState().runSync());
    return true;
  },

  lockNow() {
    // Wipe every decrypted cache along with the key.
    set({ sessionKey: null, lockStatus: 'locked', accounts: null, categories: null });
  },

  setAccounts(accounts) {
    set({ accounts });
  },

  setCategories(categories) {
    set({ categories });
  },

  setActiveTab(tab) {
    set({ activeTab: tab });
  },

  requestQuickAdd() {
    set({ pendingQuickAdd: true });
  },

  clearQuickAdd() {
    set({ pendingQuickAdd: false });
  },

  async saveSettings(patch) {
    const settings = { ...useAppStore.getState().settings, ...patch };
    await db.meta.put({ key: 'settings', value: settings });
    set({ settings });
  },

  touchData() {
    set((s) => ({ dataEpoch: s.dataEpoch + 1 }));
  },

  async refreshSyncEmail() {
    const { isSyncConfigured } = await import('../sync/client');
    if (!isSyncConfigured()) return;
    const { currentEmail } = await import('../sync/auth');
    try {
      set({ syncEmail: await currentEmail() });
    } catch {
      set({ syncEmail: null });
    }
  },

  async runSync() {
    const state = useAppStore.getState();
    const { isSyncConfigured } = await import('../sync/client');
    if (!isSyncConfigured() || !state.syncEmail || !state.sessionKey) return;
    if (state.syncStatus === 'syncing') return;

    set({ syncStatus: 'syncing' });
    try {
      const { supabaseGateway } = await import('../sync/gateway');
      const { syncNow } = await import('../sync/vaultSync');
      const { exportBackup, importBackup } = await import('../db/repo');
      const { getDeviceId } = await import('../sync/deviceId');
      const kdf = (await db.meta.get('kdfParams'))?.value as KdfParams;

      const result = await syncNow({
        gateway: supabaseGateway(),
        sessionKey: state.sessionKey,
        kdf,
        deviceId: getDeviceId(),
        localVersion: useAppStore.getState().syncVersion,
        dirty: useAppStore.getState().dataEpoch !== useAppStore.getState().lastSyncedEpoch,
        exportBackup,
        importBackup,
        saveSafetyBackup: async (json) => {
          await db.meta.put({ key: 'sync-safety', value: { json, at: Date.now() } });
        },
        onVersion: async (version) => {
          await db.meta.put({ key: 'sync', value: { version } });
          set({ syncVersion: version, lastSyncedEpoch: useAppStore.getState().dataEpoch });
        },
      });

      // A pull replaced local data — reload decrypted caches + settings.
      if (result.action === 'pull') {
        const settingsRow = await db.meta.get('settings');
        set({
          accounts: null,
          categories: null,
          settings: (settingsRow?.value as Settings) ?? DEFAULT_SETTINGS,
        });
      }
      set({ syncStatus: 'idle', lastSyncedAt: Date.now() });
    } catch {
      set({ syncStatus: 'error' });
    }
  },

  async restoreFromSync(email, password, passphrase) {
    const { signIn } = await import('../sync/auth');
    const { supabaseGateway } = await import('../sync/gateway');
    const { decryptVault } = await import('../sync/vaultCrypto');
    const { deriveKey } = await import('../crypto/keys');
    const { fromBase64 } = await import('../crypto/envelope');
    const { importBackup } = await import('../db/repo');

    await signIn(email, password);
    const remote = await supabaseGateway().fetch();
    if (!remote) throw new Error('No synced vault found for this account.');

    // Derive the key from the *remote* kdf so a fresh device can decrypt.
    const key = await deriveKey(passphrase, fromBase64(remote.kdf.saltB64), remote.kdf.iterations);
    const json = await decryptVault(key, remote.ciphertext); // throws on wrong passphrase
    await importBackup(json);
    await db.meta.put({ key: 'sync', value: { version: remote.version } });

    // Boot into the restored vault.
    await useAppStore.getState().init();
    await useAppStore.getState().unlock(passphrase);
  },
}));

// Data-layer accessor (repo.ts in Phase 2): encrypt/decrypt without components
// ever touching the key. Throws instead of silently working on a locked vault.
export function getSessionKey(): CryptoKey {
  const key = useAppStore.getState().sessionKey;
  if (!key) throw new Error('Vault is locked: no session key in memory');
  return key;
}
