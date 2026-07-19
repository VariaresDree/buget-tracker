import { useCallback, useEffect, useState } from 'react';
import {
  deleteRecurringRule,
  listRecurringRules,
  updateRecurringRule,
  type RecurringRule,
} from '../../db/repo';
import { useAccounts } from '../../hooks/useAccounts';
import { formatMoney } from '../../lib/money';
import { useAppStore } from '../../store/useAppStore';
import RecurringForm from './RecurringForm';

const FREQ_LABEL = { daily: 'day', weekly: 'week', monthly: 'month' } as const;

export default function RecurringScreen() {
  const accounts = useAccounts();
  const symbol = useAppStore((s) => s.settings.currencySymbol);
  const [rules, setRules] = useState<RecurringRule[] | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => setRules(await listRecurringRules()), []);
  useEffect(() => { void reload(); }, [reload]);

  async function togglePause(rule: RecurringRule) {
    await updateRecurringRule(rule.id, { active: !rule.active });
    await reload();
  }

  async function onDelete(rule: RecurringRule) {
    if (!window.confirm(`Delete the recurring "${rule.note || 'transaction'}"?`)) return;
    await deleteRecurringRule(rule.id);
    await reload();
  }

  function cadence(rule: RecurringRule) {
    const unit = FREQ_LABEL[rule.freq];
    return rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
  }

  if (adding) {
    return (
      <RecurringForm
        accounts={accounts}
        onDone={() => { setAdding(false); void reload(); }}
      />
    );
  }

  return (
    <section>
      <div className="screen-head">
        <h2>Recurring</h2>
        <button disabled={accounts.length === 0} onClick={() => setAdding(true)}>
          Add recurring
        </button>
      </div>
      <p className="muted">
        Due transactions are logged automatically when you unlock the app.
      </p>

      {rules === null ? null : rules.length === 0 ? (
        <p className="placeholder">No recurring transactions yet.</p>
      ) : (
        <ul className="card-list">
          {rules.map((rule) => (
            <li key={rule.id}>
              <div className="row-main">
                <strong>{rule.note || '(no note)'}</strong>
                <span className="muted">
                  {cadence(rule)} · next {rule.nextRunDate}
                  {!rule.active && ' · '}
                  {!rule.active && <span className="pill">Paused</span>}
                </span>
              </div>
              <div className="row-side">
                <span className={rule.amount >= 0 ? 'amount income' : 'amount'}>
                  {formatMoney(rule.amount, symbol)}
                </span>
                <button
                  className="secondary"
                  aria-label={`${rule.active ? 'Pause' : 'Resume'} ${rule.note || 'rule'}`}
                  onClick={() => void togglePause(rule)}
                >
                  {rule.active ? 'Pause' : 'Resume'}
                </button>
                <button
                  className="secondary danger"
                  aria-label={`Delete ${rule.note || 'rule'}`}
                  onClick={() => void onDelete(rule)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
