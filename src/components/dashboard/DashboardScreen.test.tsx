import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import { addAccount, addCategory, addTransaction } from '../../db/repo';
import { addMonths, monthOf, todayISO } from '../../lib/dates';
import { renderApp, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

const thisMonth = monthOf(todayISO());

describe('DashboardScreen', () => {
  test('shows month totals, budget bars, no-cap and uncategorized rows', async () => {
    await unlockVault();
    const acct = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const food = await addCategory({ name: 'Food', type: 'expense', monthlyCap: 500000, color: '#f97316' });
    const transport = await addCategory({ name: 'Transport', type: 'expense', monthlyCap: null, color: '#38bdf8' });
    const salary = await addCategory({ name: 'Salary', type: 'income', monthlyCap: null, color: '#4ade80' });
    await addTransaction({ date: todayISO(), accountId: acct, amount: -250000, categoryId: food });
    await addTransaction({ date: todayISO(), accountId: acct, amount: -50000, categoryId: transport });
    await addTransaction({ date: todayISO(), accountId: acct, amount: -70000 });
    await addTransaction({ date: todayISO(), accountId: acct, amount: 5000000, categoryId: salary });
    await renderApp();

    // Totals: income 50,000; spent 2,500 + 500 + 700 = 3,700
    expect(await screen.findByText('₱50,000.00')).toBeInTheDocument();
    expect(screen.getByText('₱3,700.00')).toBeInTheDocument();

    // Scope to the budget list — the pie legend repeats category names.
    const budgets = await screen.findByRole('list', { name: 'Budgets' });
    const foodRow = within(budgets).getByText('Food').closest('li')!;
    expect(within(foodRow).getByText('₱2,500.00')).toBeInTheDocument();
    expect(within(foodRow).getByText(/of ₱5,000\.00/)).toBeInTheDocument();
    expect(within(foodRow).getByText(/₱2,500\.00 left/)).toBeInTheDocument();

    const transportRow = within(budgets).getByText('Transport').closest('li')!;
    expect(within(transportRow).getByText('₱500.00')).toBeInTheDocument();
    expect(within(transportRow).getByText('No cap')).toBeInTheDocument();

    const uncatRow = within(budgets).getByText('Uncategorized').closest('li')!;
    expect(within(uncatRow).getByText('₱700.00')).toBeInTheDocument();

    // Income categories don't get budget rows
    expect(screen.queryByText('Salary')).not.toBeInTheDocument();
  });

  test('flags over-budget categories', async () => {
    await unlockVault();
    const acct = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const food = await addCategory({ name: 'Food', type: 'expense', monthlyCap: 100000, color: '#f97316' });
    await addTransaction({ date: todayISO(), accountId: acct, amount: -150000, categoryId: food });
    await renderApp();

    // The budget row renders from categories immediately; spend arrives async.
    const budgets = await screen.findByRole('list', { name: 'Budgets' });
    const foodRow = (await within(budgets).findByText('Food')).closest('li')!;
    expect(await within(foodRow).findByText(/Over by ₱500\.00/)).toBeInTheDocument();
  });

  test('renders the spending charts for the selected month', async () => {
    await unlockVault();
    const acct = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const food = await addCategory({ name: 'Food', type: 'expense', monthlyCap: null, color: '#3987e5' });
    await addTransaction({ date: todayISO(), accountId: acct, amount: -250000, categoryId: food });
    await renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Spending by category' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Spend over time' }),
    ).toBeInTheDocument();

    const legend = await screen.findByRole('list', { name: 'Category spend legend' });
    expect(within(legend).getByText('Food')).toBeInTheDocument();
    expect(within(legend).getByText('₱2,500.00')).toBeInTheDocument();
  });

  test('charts show empty states when the month has no spend', async () => {
    await unlockVault();
    await renderApp();
    expect(await screen.findAllByText(/no spending this month/i)).toHaveLength(2);
  });

  test('navigates to the previous month', async () => {
    await unlockVault();
    const acct = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const food = await addCategory({ name: 'Food', type: 'expense', monthlyCap: 500000, color: '#f97316' });
    const lastMonth = addMonths(thisMonth, -1);
    await addTransaction({ date: `${lastMonth}-15`, accountId: acct, amount: -120000, categoryId: food });
    await addTransaction({ date: todayISO(), accountId: acct, amount: -30000, categoryId: food });
    const user = userEvent.setup();
    await renderApp();

    // Total spend equals the single category's spend, so scope to the stat card.
    const spentCard = screen.getByText('Spent').closest('.hero-pill')! as HTMLElement;
    expect(await within(spentCard).findByText('₱300.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(await within(spentCard).findByText('₱1,200.00')).toBeInTheDocument();
    expect(screen.getByText(lastMonth)).toBeInTheDocument();
    expect(screen.queryByText('₱300.00')).not.toBeInTheDocument();
  });
});
