import { ChevronRight, Download, Lock, Repeat, Settings as SettingsIcon } from 'lucide-react';
import { useAppStore, type TabId } from '../../store/useAppStore';

const ITEMS: { id: TabId; label: string; icon: typeof Repeat; hint: string }[] = [
  { id: 'recurring', label: 'Recurring', icon: Repeat, hint: 'Scheduled income and bills' },
  { id: 'import', label: 'Import', icon: Download, hint: 'Bring in a bank or e-wallet CSV' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, hint: 'Currency, theme, sync, backup' },
];

/** Secondary navigation — keeps every screen reachable within the 5-tab limit. */
export default function MoreScreen() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const lockNow = useAppStore((s) => s.lockNow);

  return (
    <section>
      <div className="screen-head">
        <h2>More</h2>
      </div>
      <ul className="more-list">
        {ITEMS.map(({ id, label, icon: Icon, hint }) => (
          <li key={id}>
            {/* aria-label keeps the name crisp; the hint stays visual. */}
            <button aria-label={label} onClick={() => setActiveTab(id)}>
              <span className="row-avatar" aria-hidden="true">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <span className="row-main">
                <strong>{label}</strong>
                <span className="muted">{hint}</span>
              </span>
              <ChevronRight className="more-chevron" size={20} aria-hidden="true" />
            </button>
          </li>
        ))}
        <li>
          <button aria-label="Lock now" onClick={lockNow}>
            <span className="row-avatar" aria-hidden="true">
              <Lock size={20} strokeWidth={1.75} />
            </span>
            <span className="row-main">
              <strong>Lock now</strong>
              <span className="muted">Clear the key from memory</span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  );
}
