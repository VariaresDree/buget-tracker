import { useEffect } from 'react';
import { useAutoLock } from '../../hooks/useAutoLock';
import { useAppStore } from '../../store/useAppStore';
import SetupPassphraseScreen from '../lock/SetupPassphraseScreen';
import UnlockScreen from '../lock/UnlockScreen';

export default function AppShell() {
  const lockStatus = useAppStore((s) => s.lockStatus);
  const init = useAppStore((s) => s.init);
  const lockNow = useAppStore((s) => s.lockNow);

  useEffect(() => {
    if (lockStatus === 'loading') void init();
  }, [lockStatus, init]);

  useAutoLock();

  if (lockStatus === 'loading') return null;
  if (lockStatus === 'uninitialized') return <SetupPassphraseScreen />;
  if (lockStatus === 'locked') return <UnlockScreen />;

  return (
    <>
      <header className="app-header">
        <h1>Budget Tracker</h1>
        <button className="lock-btn" onClick={lockNow}>
          Lock
        </button>
      </header>
      <main className="app-main">
        <p className="placeholder">
          Vault unlocked. Accounts and transactions arrive in Phase 2.
        </p>
      </main>
    </>
  );
}
