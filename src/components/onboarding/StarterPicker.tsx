import { useState, type FormEvent } from 'react';
import { PieChart } from 'lucide-react';
import {
  STARTER_ACCOUNTS,
  STARTER_CATEGORIES,
  seedAccounts,
  seedCategories,
} from '../../lib/presets';
import { ACCOUNT_ICONS } from '../dashboard/AccountChips';
import { ACCOUNT_TYPE_LABELS } from '../accounts/accountTypes';

interface Props {
  kind: 'accounts' | 'categories';
  onDone: () => void;
}

/** Checklist of starter accounts or categories; seeds the chosen rows on submit. */
export default function StarterPicker({ kind, onDone }: Props) {
  const rows =
    kind === 'accounts'
      ? STARTER_ACCOUNTS.map((a) => ({
          key: a.name,
          label: a.name,
          sub: ACCOUNT_TYPE_LABELS[a.type],
          icon: ACCOUNT_ICONS[a.type],
          color: undefined as string | undefined,
        }))
      : STARTER_CATEGORIES.map((c) => ({
          key: c.name,
          label: c.name,
          sub: c.type === 'income' ? 'Income' : 'Expense',
          icon: PieChart,
          color: c.color as string | undefined,
        }));

  const [selected, setSelected] = useState(() => new Set(rows.map((_, i) => i)));
  const [busy, setBusy] = useState(false);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (kind === 'accounts') {
        await seedAccounts(STARTER_ACCOUNTS.filter((_, i) => selected.has(i)));
      } else {
        await seedCategories(STARTER_CATEGORIES.filter((_, i) => selected.has(i)));
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel-form" onSubmit={onSubmit}>
      <h2>{kind === 'accounts' ? 'Starter accounts' : 'Starter categories'}</h2>
      <p className="muted">
        {kind === 'accounts'
          ? 'Pick the accounts you use. Each starts at a zero balance — set the real amount anytime.'
          : 'Pick categories to track. Add a monthly budget to any of them later.'}
      </p>
      <ul className="card-list starter-list">
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <li key={row.key}>
              <label className="starter-row">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                />
                <span
                  className="row-avatar"
                  aria-hidden="true"
                  style={row.color ? { background: `${row.color}22`, color: row.color } : undefined}
                >
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div className="row-main">
                  <strong>{row.label}</strong>
                  <span className="muted">{row.sub}</span>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onDone}>
          Skip
        </button>
        <button type="submit" disabled={busy || selected.size === 0}>
          {busy ? 'Adding…' : `Add selected (${selected.size})`}
        </button>
      </div>
    </form>
  );
}
