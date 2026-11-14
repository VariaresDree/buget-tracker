import { useState, type FormEvent } from 'react';
import { useBusy } from '../../hooks/useBusy';
import type { AccountType } from '../../db/db';
import { addAccount, updateAccount, type Account } from '../../db/repo';
import { refreshAccounts } from '../../hooks/useAccounts';
import { parseAmountInput } from '../../lib/money';
import { ACCOUNT_TYPE_LABELS } from './accountTypes';
import FormHeader from '../common/FormHeader';

interface Props {
  account?: Account;
  onDone: () => void;
}

export default function AccountForm({ account, onDone }: Props) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'cash');
  const [balanceInput, setBalanceInput] = useState(
    account ? (account.startingBalance / 100).toFixed(2) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(save);
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    const startingBalance =
      balanceInput.trim() === '' ? 0 : parseAmountInput(balanceInput);
    if (startingBalance === null) {
      setError('Enter a valid starting balance.');
      return;
    }
    if (account) {
      await updateAccount(account.id, { name: trimmedName, type, startingBalance });
    } else {
      await addAccount({ name: trimmedName, type, startingBalance });
    }
    await refreshAccounts();
    onDone();
  }

  return (
    <form className="panel-form" onSubmit={onSubmit}>
      <FormHeader title={account ? 'Edit account' : 'Add account'} onBack={onDone} />
      <label htmlFor="account-name">Name</label>
      <input
        id="account-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label htmlFor="account-type">Type</label>
      <select
        id="account-type"
        value={type}
        onChange={(e) => setType(e.target.value as AccountType)}
      >
        {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="account-balance">Starting balance</label>
      <input
        id="account-balance"
        inputMode="decimal"
        placeholder="0.00"
        value={balanceInput}
        onChange={(e) => setBalanceInput(e.target.value)}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
