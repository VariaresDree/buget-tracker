import { useState, type FormEvent } from 'react';
import { addTransfer, type Account } from '../../db/repo';
import { todayISO } from '../../lib/dates';
import { parseAmountInput } from '../../lib/money';

interface Props {
  accounts: Account[];
  onDone: () => void;
}

export default function TransferForm({ accounts, onDone }: Props) {
  const [fromId, setFromId] = useState<number>(accounts[0].id);
  const [toId, setToId] = useState<number>(accounts[1]?.id ?? accounts[0].id);
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseAmountInput(amountInput);
    if (parsed === null || parsed <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (fromId === toId) {
      setError('Choose two different accounts.');
      return;
    }
    await addTransfer({ fromAccountId: fromId, toAccountId: toId, amount: parsed, date, note });
    onDone();
  }

  const accountOptions = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
    </option>
  ));

  return (
    <form className="panel-form" onSubmit={onSubmit}>
      <h2>Transfer between accounts</h2>
      <label htmlFor="transfer-from">From</label>
      <select
        id="transfer-from"
        value={fromId}
        onChange={(e) => setFromId(Number(e.target.value))}
      >
        {accountOptions}
      </select>
      <label htmlFor="transfer-to">To</label>
      <select
        id="transfer-to"
        value={toId}
        onChange={(e) => setToId(Number(e.target.value))}
      >
        {accountOptions}
      </select>
      <label htmlFor="transfer-amount">Amount</label>
      <input
        id="transfer-amount"
        inputMode="decimal"
        placeholder="0.00"
        value={amountInput}
        onChange={(e) => setAmountInput(e.target.value)}
      />
      <label htmlFor="transfer-date">Date</label>
      <input
        id="transfer-date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <label htmlFor="transfer-note">Note</label>
      <input
        id="transfer-note"
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
