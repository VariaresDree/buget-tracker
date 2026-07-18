import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown'] as const;

/** Locks the vault after `settings.autoLockMinutes` without user activity. */
export function useAutoLock() {
  const lockStatus = useAppStore((s) => s.lockStatus);
  const autoLockMinutes = useAppStore((s) => s.settings.autoLockMinutes);

  useEffect(() => {
    if (lockStatus !== 'unlocked') return;

    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => useAppStore.getState().lockNow(),
        autoLockMinutes * 60_000,
      );
    };

    arm();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, arm);
    return () => {
      window.clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, arm);
    };
  }, [lockStatus, autoLockMinutes]);
}
