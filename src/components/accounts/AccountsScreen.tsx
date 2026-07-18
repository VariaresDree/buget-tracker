import { useEffect, useMemo, useState } from 'react';
import { deleteAccount, listTransactions, type Account, type Transaction } from '../../db/repo';
import { refreshAccounts, useAccounts } from '../../hooks/useAccounts';
import { computeBalances } from '../../lib/balances';
import { formatMoney } from '../../lib/money';
import { useAppStore } from '../../store/useAppStore';
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
        <button onClick={() => setMode('add')}>Add account</button>
      </div>
      {accounts.length === 0 ? (
        <p className="placeholder">No accounts yet. Add your cash, e-wallet, bank, or credit card.</p>
      ) : (
        <ul className="card-list">
          {accounts.map((account) => (
            <li key={account.id}>
              <div className="row-main">
                <strong>{account.name}</strong>
                <span className="muted">{ACCOUNT_TYPE_LABELS[account.type]}</span>
              </div>
              <div className="row-side">
                <span className="amount">
                  {formatMoney(balances.get(account.id) ?? account.startingBalance, symbol)}
                </span>
                <button
                  className="secondary"
                  aria-label={`Edit ${account.name}`}
                  onClick={() => setMode({ editId: account.id })}
                >
                  Edit
                </button>
                <button
                  className="secondary danger"
                  aria-label={`Delete ${account.name}`}
                  onClick={() => void onDelete(account)}
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
