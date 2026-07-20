import { Home, MoreHorizontal, PieChart, Receipt, Wallet } from 'lucide-react';
import { useAppStore, type TabId } from '../../store/useAppStore';

/** Five top-level destinations (the bottom-nav maximum); the rest live in More. */
const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'categories', label: 'Budgets', icon: PieChart },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

/** Sub-screens opened from More keep the More tab highlighted. */
const UNDER_MORE: TabId[] = ['recurring', 'import', 'settings', 'more'];

export default function TabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = id === 'more' ? UNDER_MORE.includes(activeTab) : id === activeTab;
        return (
          <button
            key={id}
            className={active ? 'active' : undefined}
            aria-current={active ? 'page' : undefined}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
