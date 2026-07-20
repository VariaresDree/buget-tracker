import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { addAccount, addRecurringRule, listRecurringRules } from '../../db/repo';
import { openTab, renderApp, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

async function openRecurringTab(user: ReturnType<typeof userEvent.setup>) {
  await openTab(user, 'Recurring');
}

describe('RecurringScreen', () => {
  test('creates a recurring rule', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openRecurringTab(user);

    await user.click(screen.getByRole('button', { name: 'Add recurring' }));
    await user.type(screen.getByLabelText('Amount'), '1500');
    await user.type(screen.getByLabelText('Note'), 'Rent');
    const freq = screen.getByLabelText('Frequency');
    await user.selectOptions(freq, within(freq).getByRole('option', { name: 'Monthly' }));
    // Date inputs don't respond to userEvent.type reliably; set the value directly.
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-08-01' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Rent')).toBeInTheDocument();
    const [rule] = await listRecurringRules();
    expect(rule).toMatchObject({
      amount: -150000, note: 'Rent', freq: 'monthly',
      startDate: '2026-08-01', nextRunDate: '2026-08-01', active: true,
    });
  });

  test('pauses and resumes a rule', async () => {
    await unlockVault();
    const acct = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    await addRecurringRule({
      accountId: acct, categoryId: null, amount: -150000, note: 'Rent',
      freq: 'monthly', interval: 1, startDate: '2026-08-01', nextRunDate: '2026-08-01', endDate: null,
    });
    const user = userEvent.setup();
    await renderApp();
    await openRecurringTab(user);

    await user.click(await screen.findByRole('button', { name: 'Pause Rent' }));
    expect(await screen.findByText('Paused')).toBeInTheDocument();
    expect((await listRecurringRules())[0].active).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Resume Rent' }));
    expect((await listRecurringRules())[0].active).toBe(true);
  });

  test('deletes a rule after confirmation', async () => {
    await unlockVault();
    const acct = await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    await addRecurringRule({
      accountId: acct, categoryId: null, amount: -150000, note: 'Rent',
      freq: 'monthly', interval: 1, startDate: '2026-08-01', nextRunDate: '2026-08-01', endDate: null,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    await renderApp();
    await openRecurringTab(user);

    await user.click(await screen.findByRole('button', { name: 'Delete Rent' }));
    expect(await screen.findByText(/no recurring transactions/i)).toBeInTheDocument();
    expect(await listRecurringRules()).toHaveLength(0);
  });
});
