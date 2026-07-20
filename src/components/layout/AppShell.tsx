import { useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useAutoLock } from '../../hooks/useAutoLock';
import { useAutoSync } from '../../hooks/useAutoSync';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import AccountsScreen from '../accounts/AccountsScreen';
import CategoriesScreen from '../categories/CategoriesScreen';
import Fab from '../common/Fab';
import DashboardScreen from '../dashboard/DashboardScreen';
import ImportScreen from '../import/ImportScreen';
import RecurringScreen from '../recurring/RecurringScreen';
import SettingsScreen from '../settings/SettingsScreen';
import SetupPassphraseScreen from '../lock/SetupPassphraseScreen';
import UnlockScreen from '../lock/UnlockScreen';
import TransactionsScreen from '../transactions/TransactionsScreen';
import MoreScreen from './MoreScreen';
import TabBar from './TabBar';

/** Quick-add is only offered where a transaction is the obvious next action. */
const FAB_TABS = ['dashboard', 'transactions', 'accounts'];

export default function AppShell() {
  const lockStatus = useAppStore((s) => s.lockStatus);
  const init = useAppStore((s) => s.init);
  const lockNow = useAppStore((s) => s.lockNow);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const requestQuickAdd = useAppStore((s) => s.requestQuickAdd);

  useEffect(() => {
    if (lockStatus === 'loading') void init();
  }, [lockStatus, init]);

  useAutoLock();
  useAutoSync();
  useTheme();

  if (lockStatus === 'loading') return null;
  if (lockStatus === 'uninitialized') return <SetupPassphraseScreen />;
  if (lockStatus === 'locked') return <UnlockScreen />;

  function onQuickAdd() {
    setActiveTab('transactions');
    requestQuickAdd();
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <h1>Budget Tracker</h1>
        <button className="icon-btn" aria-label="Lock" onClick={lockNow}>
          <Lock size={20} aria-hidden="true" />
        </button>
      </header>
      <main className="app-main" id="main">
        {activeTab === 'dashboard' && <DashboardScreen />}
        {activeTab === 'transactions' && <TransactionsScreen />}
        {activeTab === 'accounts' && <AccountsScreen />}
        {activeTab === 'categories' && <CategoriesScreen />}
        {activeTab === 'more' && <MoreScreen />}
        {activeTab === 'recurring' && <RecurringScreen />}
        {activeTab === 'import' && <ImportScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>
      {FAB_TABS.includes(activeTab) && (
        <Fab label="Quick add transaction" onClick={onQuickAdd} />
      )}
      <TabBar />
    </>
  );
}
