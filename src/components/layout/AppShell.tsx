import { useEffect } from 'react';
import { useAutoLock } from '../../hooks/useAutoLock';
import { useAppStore } from '../../store/useAppStore';
import AccountsScreen from '../accounts/AccountsScreen';
import CategoriesScreen from '../categories/CategoriesScreen';
import DashboardScreen from '../dashboard/DashboardScreen';
import ImportScreen from '../import/ImportScreen';
import RecurringScreen from '../recurring/RecurringScreen';
import SettingsScreen from '../settings/SettingsScreen';
import SetupPassphraseScreen from '../lock/SetupPassphraseScreen';
import UnlockScreen from '../lock/UnlockScreen';
import TransactionsScreen from '../transactions/TransactionsScreen';
import TabBar from './TabBar';

export default function AppShell() {
  const lockStatus = useAppStore((s) => s.lockStatus);
  const init = useAppStore((s) => s.init);
  const lockNow = useAppStore((s) => s.lockNow);
  const activeTab = useAppStore((s) => s.activeTab);

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
        {activeTab === 'dashboard' && <DashboardScreen />}
        {activeTab === 'transactions' && <TransactionsScreen />}
        {activeTab === 'accounts' && <AccountsScreen />}
        {activeTab === 'categories' && <CategoriesScreen />}
        {activeTab === 'recurring' && <RecurringScreen />}
        {activeTab === 'import' && <ImportScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>
      <TabBar />
    </>
  );
}
