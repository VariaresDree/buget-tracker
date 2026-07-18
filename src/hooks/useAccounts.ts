import { useEffect } from 'react';
import { listAccounts } from '../db/repo';
import { useAppStore } from '../store/useAppStore';

/** Reload the store's account cache from the repo (call after any account CRUD). */
export async function refreshAccounts(): Promise<void> {
  useAppStore.getState().setAccounts(await listAccounts());
}

/** Decrypted accounts, loading them on first use after unlock. */
export function useAccounts() {
  const accounts = useAppStore((s) => s.accounts);
  const lockStatus = useAppStore((s) => s.lockStatus);

  useEffect(() => {
    if (lockStatus === 'unlocked' && accounts === null) void refreshAccounts();
  }, [lockStatus, accounts]);

  return accounts ?? [];
}
