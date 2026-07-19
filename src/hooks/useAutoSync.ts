import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

const DEBOUNCE_MS = 3000;

/**
 * Pushes local changes to sync a few seconds after they settle. Each new write
 * resets the timer (debounce), so a burst of edits produces one push. Only runs
 * when unlocked and signed in.
 */
export function useAutoSync() {
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const syncEmail = useAppStore((s) => s.syncEmail);
  const lockStatus = useAppStore((s) => s.lockStatus);

  useEffect(() => {
    if (lockStatus !== 'unlocked' || !syncEmail) return;
    const dirty =
      useAppStore.getState().dataEpoch !== useAppStore.getState().lastSyncedEpoch;
    if (!dirty) return;

    const timer = window.setTimeout(() => void useAppStore.getState().runSync(), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [dataEpoch, syncEmail, lockStatus]);
}
