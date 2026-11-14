import { useState, type FormEvent } from 'react';
import { useBusy } from '../../hooks/useBusy';
import { addTransfer, type Account } from '../../db/repo';
import { todayISO } from '../../lib/dates';
import { parseAmountInput } from '../../lib/money';
import FormHeader from '../common/FormHeader';
import FieldError, { useFieldError } from '../common/FieldError';
import { showToast } from '../../store/useAppStore';

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
  const { error, fail, invalid } = useFieldError();
  const [busy, run] = useBusy();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(save);
  }

  async function save() {
    const parsed = parseAmountInput(amountInput);
    if (parsed === null || parsed <= 0) {
      fail('transfer-amount', 'Enter an amount greater than zero.');
      return;
    }
    if (fromId === toId) {
      fail('transfer-to', 'Choose two different accounts.');
      return;
    }
    await addTransfer({ fromAccountId: fromId, toAccountId: toId, amount: parsed, date, note });
    showToast('Transfer saved');
    onDone();
  }

  const accountOptions = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
    </option>
  ));

  return (
    <form className="panel-form" onSubmit={onSubmit}>
      <FormHeader title="Transfer between accounts" onBack={onDone} />
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
        id="transfer-to" {...invalid('transfer-to')}
        value={toId}
        onChange={(e) => setToId(Number(e.target.value))}
      >
        {accountOptions}
      </select>
      <FieldError error={error} field="transfer-to" />
      <label htmlFor="transfer-amount">Amount</label>
      <input
        id="transfer-amount" {...invalid('transfer-amount')}
        inputMode="decimal"
        placeholder="0.00"
        value={amountInput}
        onChange={(e) => setAmountInput(e.target.value)}
      />
      <FieldError error={error} field="transfer-amount" />
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
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
