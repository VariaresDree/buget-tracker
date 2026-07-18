import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { addAccount, addTransaction, listAccounts } from '../../db/repo';
import { renderApp, renderUnlocked, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

async function openAccountsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Accounts' }));
}

describe('AccountsScreen', () => {
  test('adds an account through the form', async () => {
    const user = userEvent.setup();
    await renderUnlocked();
    await openAccountsTab(user);

    await user.click(screen.getByRole('button', { name: 'Add account' }));
    await user.type(screen.getByLabelText('Name'), 'GCash');
    const type = screen.getByLabelText('Type');
    await user.selectOptions(type, within(type).getByRole('option', { name: 'E-Wallet' }));
    await user.type(screen.getByLabelText('Starting balance'), '1,500.00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('GCash')).toBeInTheDocument();
    expect(screen.getByText('E-Wallet')).toBeInTheDocument();
    expect(screen.getByText('₱1,500.00')).toBeInTheDocument();

    const [account] = await listAccounts();
    expect(account).toMatchObject({ name: 'GCash', type: 'ewallet', startingBalance: 150000 });
  });

  test('shows the computed balance including transactions', async () => {
    await unlockVault();
    const id = await addAccountSeed();
    await addTransaction({ date: '2026-07-10', accountId: id, amount: -25000 });
    const user = userEvent.setup();
    await renderApp();
    await openAccountsTab(user);

    expect(await screen.findByText('₱1,250.00')).toBeInTheDocument();
  });

  test('edits an account name', async () => {
    await unlockVault();
    await addAccountSeed();
    const user = userEvent.setup();
    await renderApp();
    await openAccountsTab(user);

    await user.click(await screen.findByRole('button', { name: 'Edit Wallet' }));
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Cash Wallet');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Cash Wallet')).toBeInTheDocument();
  });

  test('deletes an account after confirmation', async () => {
    await unlockVault();
    await addAccountSeed();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    await renderApp();
    await openAccountsTab(user);

    await user.click(await screen.findByRole('button', { name: 'Delete Wallet' }));

    expect(await screen.findByText(/no accounts yet/i)).toBeInTheDocument();
    expect(await listAccounts()).toHaveLength(0);
  });
});

function addAccountSeed() {
  return addAccount({ name: 'Wallet', type: 'cash', startingBalance: 150000 });
}
