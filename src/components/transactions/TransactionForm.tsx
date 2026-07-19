import { useState, type FormEvent } from 'react';
import {
  addTransaction,
  updateTransaction,
  type Account,
  type Transaction,
} from '../../db/repo';
import { useCategories } from '../../hooks/useCategories';
import { todayISO } from '../../lib/dates';
import { parseAmountInput } from '../../lib/money';

interface Props {
  accounts: Account[];
  tx?: Transaction;
  onDone: () => void;
}

export default function TransactionForm({ accounts, tx, onDone }: Props) {
  const categories = useCategories();
  const [kind, setKind] = useState<'expense' | 'income'>(
    tx && tx.amount > 0 ? 'income' : 'expense',
  );
  const [amountInput, setAmountInput] = useState(
    tx ? (Math.abs(tx.amount) / 100).toFixed(2) : '',
  );
  const [accountId, setAccountId] = useState<number>(tx?.accountId ?? accounts[0].id);
  const [categoryId, setCategoryId] = useState<number | 'none'>(tx?.categoryId ?? 'none');
  const [date, setDate] = useState(tx?.date ?? todayISO());
  const [note, setNote] = useState(tx?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = categories.filter((c) => c.type === kind && !c.archived);

  function switchKind(next: 'expense' | 'income') {
    setKind(next);
    // A category of the other type can't stay selected.
    if (
      categoryId !== 'none' &&
      categories.find((c) => c.id === categoryId)?.type !== next
    ) {
      setCategoryId('none');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseAmountInput(amountInput);
    if (parsed === null || parsed <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    const amount = kind === 'expense' ? -parsed : parsed;
    const finalCategoryId = categoryId === 'none' ? null : categoryId;
    if (tx) {
      await updateTransaction(tx.id, { amount, accountId, categoryId: finalCategoryId, date, note });
    } else {
      await addTransaction({ date, accountId, categoryId: finalCategoryId, amount, note });
    }
    onDone();
  }

  return (
    <form className="panel-form" onSubmit={onSubmit}>
      <h2>{tx ? 'Edit transaction' : 'Add transaction'}</h2>
      <fieldset className="kind-toggle">
        <label>
          <input
            type="radio"
            name="kind"
            checked={kind === 'expense'}
            onChange={() => switchKind('expense')}
          />
          Expense
        </label>
        <label>
          <input
            type="radio"
            name="kind"
            checked={kind === 'income'}
            onChange={() => switchKind('income')}
          />
          Income
        </label>
      </fieldset>
      <label htmlFor="tx-amount">Amount</label>
      <input
        id="tx-amount"
        inputMode="decimal"
        placeholder="0.00"
        value={amountInput}
        onChange={(e) => setAmountInput(e.target.value)}
      />
      <label htmlFor="tx-account">Account</label>
      <select
        id="tx-account"
        value={accountId}
        onChange={(e) => setAccountId(Number(e.target.value))}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <label htmlFor="tx-category">Category</label>
      <select
        id="tx-category"
        value={categoryId === 'none' ? 'none' : String(categoryId)}
        onChange={(e) =>
          setCategoryId(e.target.value === 'none' ? 'none' : Number(e.target.value))
        }
      >
        <option value="none">Uncategorized</option>
        {categoryOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label htmlFor="tx-date">Date</label>
      <input
        id="tx-date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <label htmlFor="tx-note">Note</label>
      <input
        id="tx-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit">Save</button>
      </div>
    </form>
  );
}
