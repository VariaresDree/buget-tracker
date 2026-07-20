import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { addAccount, addCategory, addTransaction, listTransactions } from '../../db/repo';
import { openTab, renderApp, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

async function openTransactionsTab(user: ReturnType<typeof userEvent.setup>) {
  await openTab(user, 'Transactions');
}

describe('TransactionsScreen', () => {
  test('adds an expense through the form', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openTransactionsTab(user);

    await user.click(screen.getByRole('button', { name: 'Add transaction' }));
    await user.type(screen.getByLabelText('Amount'), '250');
    await user.type(screen.getByLabelText('Note'), 'lunch');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('-₱250.00')).toBeInTheDocument();
    expect(screen.getByText('lunch')).toBeInTheDocument();

    const [tx] = await listTransactions();
    expect(tx.amount).toBe(-25000);
  });

  test('adds income when the income toggle is selected', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openTransactionsTab(user);

    await user.click(screen.getByRole('button', { name: 'Add transaction' }));
    await user.click(screen.getByLabelText('Income'));
    await user.type(screen.getByLabelText('Amount'), '500');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('₱500.00')).toBeInTheDocument();
    const [tx] = await listTransactions();
    expect(tx.amount).toBe(50000);
  });

  test('records a transfer as two linked legs', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    await addAccount({ name: 'GCash', type: 'ewallet', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openTransactionsTab(user);

    await user.click(screen.getByRole('button', { name: 'Transfer' }));
    const from = screen.getByLabelText('From');
    await user.selectOptions(from, within(from).getByRole('option', { name: 'Wallet' }));
    const to = screen.getByLabelText('To');
    await user.selectOptions(to, within(to).getByRole('option', { name: 'GCash' }));
    await user.type(screen.getByLabelText('Amount'), '300');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Transfer out')).toBeInTheDocument();
    expect(screen.getByText('Transfer in')).toBeInTheDocument();

    const txs = await listTransactions();
    expect(txs).toHaveLength(2);
    expect(txs[0].transferGroupId).toBe(txs[1].transferGroupId);
  });

  test('filters the list by account', async () => {
    await unlockVault();
    const a1 = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const a2 = await addAccount({ name: 'BPI', type: 'bank', startingBalance: 0 });
    await addTransaction({ date: '2026-07-01', accountId: a1, amount: -11100, note: 'wallet spend' });
    await addTransaction({ date: '2026-07-02', accountId: a2, amount: -22200, note: 'bank spend' });
    const user = userEvent.setup();
    await renderApp();
    await openTransactionsTab(user);

    expect(await screen.findByText('wallet spend')).toBeInTheDocument();
    const filter = screen.getByLabelText('Account');
    await user.selectOptions(filter, within(filter).getByRole('option', { name: 'BPI' }));

    expect(await screen.findByText('bank spend')).toBeInTheDocument();
    expect(screen.queryByText('wallet spend')).not.toBeInTheDocument();
  });

  test('edits a transaction amount', async () => {
    await unlockVault();
    const a1 = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    await addTransaction({ date: '2026-07-01', accountId: a1, amount: -25000, note: 'groceries' });
    const user = userEvent.setup();
    await renderApp();
    await openTransactionsTab(user);

    const row = (await screen.findByText('groceries')).closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const amount = screen.getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '400');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('-₱400.00')).toBeInTheDocument();
  });

  test('assigns a category to an expense', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const food = await addCategory({ name: 'Food', type: 'expense', monthlyCap: null, color: '#f97316' });
    await addCategory({ name: 'Salary', type: 'income', monthlyCap: null, color: '#4ade80' });
    const user = userEvent.setup();
    await renderApp();
    await openTransactionsTab(user);

    await user.click(screen.getByRole('button', { name: 'Add transaction' }));
    const category = screen.getByLabelText('Category');
    await user.selectOptions(category, within(category).getByRole('option', { name: 'Food' }));
    await user.type(screen.getByLabelText('Amount'), '250');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Match the row title only — a bare findByText('Food') can grab the form's
    // <option> just before the form unmounts, leaving a detached element.
    expect(
      await screen.findByText('Food', { selector: 'strong' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    const [tx] = await listTransactions();
    expect(tx.categoryId).toBe(food);
  });

  test('category options follow the expense/income toggle', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    await addCategory({ name: 'Food', type: 'expense', monthlyCap: null, color: '#f97316' });
    await addCategory({ name: 'Salary', type: 'income', monthlyCap: null, color: '#4ade80' });
    const user = userEvent.setup();
    await renderApp();
    await openTransactionsTab(user);

    await user.click(screen.getByRole('button', { name: 'Add transaction' }));
    const category = screen.getByLabelText('Category');
    expect(within(category).getByRole('option', { name: 'Food' })).toBeInTheDocument();
    expect(within(category).queryByRole('option', { name: 'Salary' })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Income'));
    expect(within(category).getByRole('option', { name: 'Salary' })).toBeInTheDocument();
    expect(within(category).queryByRole('option', { name: 'Food' })).not.toBeInTheDocument();
  });

  test('deletes a transaction after confirmation', async () => {
    await unlockVault();
    const a1 = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    await addTransaction({ date: '2026-07-01', accountId: a1, amount: -25000, note: 'groceries' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    await renderApp();
    await openTransactionsTab(user);

    const row = (await screen.findByText('groceries')).closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/no transactions/i)).toBeInTheDocument();
    expect(await listTransactions()).toHaveLength(0);
  });
});
