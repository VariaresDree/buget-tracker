import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Wallet } from 'lucide-react';
import { deleteAccount, listTransactions, type Account, type Transaction } from '../../db/repo';
import { refreshAccounts, useAccounts } from '../../hooks/useAccounts';
import { computeBalances } from '../../lib/balances';
import { formatMoney } from '../../lib/money';
import { useAppStore } from '../../store/useAppStore';
import EmptyState from '../common/EmptyState';
import { ACCOUNT_ICONS } from '../dashboard/AccountChips';
import AccountForm from './AccountForm';
import { ACCOUNT_TYPE_LABELS } from './accountTypes';

type Mode = 'list' | 'add' | { editId: number };

export default function AccountsScreen() {
  const accounts = useAccounts();
  const symbol = useAppStore((s) => s.settings.currencySymbol);
  const [mode, setMode] = useState<Mode>('list');
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    void listTransactions().then(setTransactions);
  }, [accounts]);

  const balances = useMemo(
    () => computeBalances(accounts, transactions ?? []),
    [accounts, transactions],
  );

  async function onDelete(account: Account) {
    if (!window.confirm(`Delete ${account.name} and all its transactions?`)) return;
    await deleteAccount(account.id);
    await refreshAccounts();
  }

  if (mode === 'add') {
    return <AccountForm onDone={() => setMode('list')} />;
  }
  if (typeof mode === 'object') {
    return (
      <AccountForm
        account={accounts.find((a) => a.id === mode.editId)}
        onDone={() => setMode('list')}
      />
    );
  }

  return (
    <section>
      <div className="screen-head">
        <h2>Accounts</h2>
        {/* When empty, the empty-state CTA is the single primary action. */}
        {accounts.length > 0 && (
          <button className="btn-primary" onClick={() => setMode('add')}>
            Add account
          </button>
        )}
      </div>
      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          hint="Add your cash, e-wallet, bank, or credit card to start tracking balances."
          actionLabel="Add account"
          onAction={() => setMode('add')}
        />
      ) : (
        <ul className="card-list">
          {accounts.map((account) => {
            const Icon = ACCOUNT_ICONS[account.type];
            return (
              <li key={account.id}>
                <div className="row-lead">
                  <span className="row-avatar" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div className="row-main">
                    <strong>{account.name}</strong>
                    <span className="muted">{ACCOUNT_TYPE_LABELS[account.type]}</span>
                  </div>
                </div>
                <div className="row-side">
                  <span className="amount">
                    {formatMoney(balances.get(account.id) ?? account.startingBalance, symbol)}
                  </span>
                  <button
                    className="icon-btn"
                    aria-label={`Edit ${account.name}`}
                    onClick={() => setMode({ editId: account.id })}
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-btn danger"
                    aria-label={`Delete ${account.name}`}
                    onClick={() => void onDelete(account)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
