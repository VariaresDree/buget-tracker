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

export type TabId = 'dashboard' | 'transactions' | 'accounts' | 'categories' | 'import';

interface AppState {
  lockStatus: LockStatus;
  sessionKey: CryptoKey | null;
  settings: Settings;
  /** Decrypted caches; null = not loaded. Wiped on lock. */
  accounts: Account[] | null;
  categories: Category[] | null;
  activeTab: TabId;
  init: () => Promise<void>;
  setupPassphrase: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  lockNow: () => void;
  setAccounts: (accounts: Account[]) => void;
  setCategories: (categories: Category[]) => void;
  setActiveTab: (tab: TabId) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  lockStatus: 'loading',
  sessionKey: null,
  settings: DEFAULT_SETTINGS,
  accounts: null,
  categories: null,
  activeTab: 'dashboard',

  async init() {
    const kdf = await db.meta.get('kdfParams');
    set({ lockStatus: kdf ? 'locked' : 'uninitialized' });
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
}));

// Data-layer accessor (repo.ts in Phase 2): encrypt/decrypt without components
// ever touching the key. Throws instead of silently working on a locked vault.
export function getSessionKey(): CryptoKey {
  const key = useAppStore.getState().sessionKey;
  if (!key) throw new Error('Vault is locked: no session key in memory');
  return key;
}
