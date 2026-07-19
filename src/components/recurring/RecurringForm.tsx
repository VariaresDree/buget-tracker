import { useState, type FormEvent } from 'react';
import type { Frequency } from '../../db/db';
import { addRecurringRule, type Account } from '../../db/repo';
import { useCategories } from '../../hooks/useCategories';
import { todayISO } from '../../lib/dates';
import { parseAmountInput } from '../../lib/money';

interface Props {
  accounts: Account[];
  onDone: () => void;
}

export default function RecurringForm({ accounts, onDone }: Props) {
  const categories = useCategories();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [categoryId, setCategoryId] = useState<number | 'none'>('none');
  const [note, setNote] = useState('');
  const [freq, setFreq] = useState<Frequency>('monthly');
  const [interval, setIntervalValue] = useState('1');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = categories.filter((c) => c.type === kind && !c.archived);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseAmountInput(amountInput);
    if (parsed === null || parsed <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    const everyN = Math.max(1, Number(interval) || 1);
    await addRecurringRule({
      accountId,
      categoryId: categoryId === 'none' ? null : categoryId,
      amount: kind === 'expense' ? -parsed : parsed,
      note,
      freq,
      interval: everyN,
      startDate,
      nextRunDate: startDate,
      endDate: endDate === '' ? null : endDate,
    });
    onDone();
  }

  return (
    <form className="panel-form" onSubmit={onSubmit}>
      <h2>Add recurring transaction</h2>
      <fieldset className="kind-toggle">
        <label>
          <input type="radio" name="rkind" checked={kind === 'expense'} onChange={() => setKind('expense')} />
          Expense
        </label>
        <label>
          <input type="radio" name="rkind" checked={kind === 'income'} onChange={() => setKind('income')} />
          Income
        </label>
      </fieldset>

      <label htmlFor="r-amount">Amount</label>
      <input id="r-amount" inputMode="decimal" placeholder="0.00" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />

      <label htmlFor="r-account">Account</label>
      <select id="r-account" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <label htmlFor="r-category">Category</label>
      <select
        id="r-category"
        value={categoryId === 'none' ? 'none' : String(categoryId)}
        onChange={(e) => setCategoryId(e.target.value === 'none' ? 'none' : Number(e.target.value))}
      >
        <option value="none">Uncategorized</option>
        {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <label htmlFor="r-note">Note</label>
      <input id="r-note" value={note} onChange={(e) => setNote(e.target.value)} />

      <label htmlFor="r-freq">Frequency</label>
      <select id="r-freq" value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>

      <label htmlFor="r-interval">Every</label>
      <input id="r-interval" inputMode="numeric" value={interval} onChange={(e) => setIntervalValue(e.target.value)} />

      <label htmlFor="r-start">Start date</label>
      <input id="r-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />

      <label htmlFor="r-end">End date (optional)</label>
      <input id="r-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onDone}>Cancel</button>
        <button type="submit">Save</button>
      </div>
    </form>
  );
}
