import { useEffect } from 'react';
import { listCategories } from '../db/repo';
import { useAppStore } from '../store/useAppStore';

/** Reload the store's category cache from the repo (call after category CRUD). */
export async function refreshCategories(): Promise<void> {
  useAppStore.getState().setCategories(await listCategories());
}

/** Decrypted categories, loading them on first use after unlock. */
export function useCategories() {
  const categories = useAppStore((s) => s.categories);
  const lockStatus = useAppStore((s) => s.lockStatus);

  useEffect(() => {
    if (lockStatus === 'unlocked' && categories === null) void refreshCategories();
  }, [lockStatus, categories]);

  return categories ?? [];
}
