import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Pencil, Receipt, SearchX, Trash2 } from 'lucide-react';
import { deleteTransaction, listTransactions, type Transaction } from '../../db/repo';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { formatDay, formatMonth, monthOf } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { matchesQuery } from '../../lib/search';
import { showToast, useAppStore } from '../../store/useAppStore';
import EmptyState from '../common/EmptyState';
import TransactionForm from './TransactionForm';
import TransferForm from './TransferForm';
import { useBackClose } from '../../hooks/useBackClose';

type Mode =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'transfer' }
  | { kind: 'edit'; tx: Transaction };

export default function TransactionsScreen() {
  const accounts = useAccounts();
  const categories = useCategories();
  const symbol = useAppStore((s) => s.settings.currencySymbol);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [filterAccount, setFilterAccount] = useState<'all' | number>('all');
  const [filterMonth, setFilterMonth] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');
  const pendingQuickAdd = useAppStore((s) => s.pendingQuickAdd);
  const clearQuickAdd = useAppStore((s) => s.clearQuickAdd);
  // `accounts` is [] both while loading and when genuinely empty — the raw
  // store value distinguishes them, so the FAB isn't dismissed prematurely.
  const accountsLoaded = useAppStore((s) => s.accounts !== null);

  // The floating quick-add button opens this screen's form.
  useEffect(() => {
    if (!pendingQuickAdd || !accountsLoaded) return;
    clearQuickAdd();
    if (accounts.length > 0) setMode({ kind: 'add' });
  }, [pendingQuickAdd, accountsLoaded, accounts.length, clearQuickAdd]);

  const reload = useCallback(async () => {
    setTransactions(await listTransactions());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const months = useMemo(
    () => [...new Set((transactions ?? []).map((t) => monthOf(t.date)))].sort().reverse(),
    [transactions],
  );

  const accountName = useCallback(
    (id: number) => accounts.find((a) => a.id === id)?.name ?? 'Unknown account',
    [accounts],
  );

  const categoryName = useCallback(
    (tx: Transaction) =>
      tx.transferGroupId
        ? 'Transfer'
        : (categories.find((c) => c.id === tx.categoryId)?.name ?? ''),
    [categories],
  );

  const visible = useMemo(
    () =>
      (transactions ?? []).filter(
        (t) =>
          (filterAccount === 'all' || t.accountId === filterAccount) &&
          (filterMonth === 'all' || monthOf(t.date) === filterMonth) &&
          matchesQuery(t, query, accountName(t.accountId), categoryName(t)),
      ),
    [transactions, filterAccount, filterMonth, query, accountName, categoryName],
  );

  const filtering = query.trim() !== '' || filterAccount !== 'all' || filterMonth !== 'all';
  function clearFilters() {
    setQuery('');
    setFilterAccount('all');
    setFilterMonth('all');
  }

  // `visible` is newest-first, so each day's rows are already together.
  const days = useMemo(() => {
    const groups: { date: string; rows: Transaction[] }[] = [];
    for (const tx of visible) {
      const last = groups[groups.length - 1];
      if (last?.date === tx.date) last.rows.push(tx);
      else groups.push({ date: tx.date, rows: [tx] });
    }
    return groups;
  }, [visible]);

  async function onDelete(tx: Transaction) {
    const message = tx.transferGroupId
      ? 'Delete both legs of this transfer?'
      : 'Delete this transaction?';
    if (!window.confirm(message)) return;
    await deleteTransaction(tx.id);
    await reload();
    showToast('Transaction deleted');
  }

  function closeForm() {
    setMode({ kind: 'list' });
    void reload();
  }
  useBackClose(mode.kind !== 'list', closeForm);

  if (mode.kind === 'add') {
    return <TransactionForm accounts={accounts} onDone={closeForm} />;
  }
  if (mode.kind === 'edit') {
    return <TransactionForm accounts={accounts} tx={mode.tx} onDone={closeForm} />;
  }
  if (mode.kind === 'transfer') {
    return <TransferForm accounts={accounts} onDone={closeForm} />;
  }

  return (
    <section>
      <div className="screen-head">
        <h2>Transactions</h2>
        <div className="screen-actions">
          <button
            className="btn-primary"
            disabled={accounts.length === 0}
            onClick={() => setMode({ kind: 'add' })}
          >
            Add transaction
          </button>
          <button
            className="secondary"
            disabled={accounts.length < 2}
            onClick={() => setMode({ kind: 'transfer' })}
          >
            Transfer
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filter-field filter-search">
          <label htmlFor="filter-search">Search</label>
          <input
            id="filter-search"
            type="search"
            placeholder="Note, category, account or amount"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="filter-account">Account</label>
          <select
            id="filter-account"
            value={filterAccount === 'all' ? 'all' : String(filterAccount)}
            onChange={(e) =>
              setFilterAccount(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="filter-month">Month</label>
          <select
            id="filter-month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {transactions === null ? null : transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          hint={
            accounts.length === 0
              ? 'Add an account first, then log your spending and income here.'
              : 'Log your first expense or income to see it here.'
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching transactions"
          hint="Nothing fits the current search and filters."
          actionLabel={filtering ? 'Clear filters' : undefined}
          onAction={filtering ? clearFilters : undefined}
        />
      ) : (
        days.map((day) => (
          <section key={day.date}>
            <h3 className="day-header">{formatDay(day.date)}</h3>
            <ul className="card-list">
              {day.rows.map((tx) => {
                const category = categories.find((c) => c.id === tx.categoryId);
                const isTransfer = Boolean(tx.transferGroupId);
                return (
                  <li key={tx.id}>
                    <div className="row-lead">
                      <span
                        className="row-avatar"
                        aria-hidden="true"
                        style={
                          category
                            ? { background: `${category.color}22`, color: category.color }
                            : undefined
                        }
                      >
                        {isTransfer ? (
                          <ArrowLeftRight size={20} strokeWidth={1.75} />
                        ) : (
                          <Receipt size={20} strokeWidth={1.75} />
                        )}
                      </span>
                      <div className="row-main">
                        <strong>
                          {isTransfer
                            ? tx.amount < 0
                              ? 'Transfer out'
                              : 'Transfer in'
                            : (category?.name ?? accountName(tx.accountId))}
                        </strong>
                        {tx.note && <span className="muted">{tx.note}</span>}
                      </div>
                    </div>
                    <div className="row-side">
                      <span className={tx.amount >= 0 ? 'amount income' : 'amount'}>
                        {formatMoney(tx.amount, symbol)}
                      </span>
                      {!isTransfer && (
                        <button
                          className="icon-btn"
                          aria-label="Edit"
                          onClick={() => setMode({ kind: 'edit', tx })}
                        >
                          <Pencil size={18} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        className="icon-btn danger"
                        aria-label="Delete"
                        onClick={() => void onDelete(tx)}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
