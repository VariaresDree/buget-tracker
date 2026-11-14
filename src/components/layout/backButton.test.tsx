import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import { addAccount, listTransactions } from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';
import { openTab, renderApp, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

/** Press the phone's back button and let the popstate event land. */
async function pressBack() {
  await act(async () => {
    history.back();
    await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
  });
}

describe('phone back button', () => {
  test('closes an open form instead of leaving the screen', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openTab(user, 'Transactions');

    await user.click(await screen.findByRole('button', { name: 'Add transaction' }));
    expect(screen.getByRole('heading', { name: 'Add transaction' })).toBeInTheDocument();

    await pressBack();

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add transaction' })).not.toBeInTheDocument();
    expect(useAppStore.getState().activeTab).toBe('transactions');
  });

  test('the back arrow closes the form, and back then leaves the tab', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openTab(user, 'Accounts');

    await user.click(await screen.findByRole('button', { name: 'Add account' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Accounts' })).toBeInTheDocument();
    // The form's history entry is gone, so one Back returns to Home.
    await waitFor(() => expect(history.state).toEqual({ tab: 'accounts' }));

    await pressBack();
    expect(useAppStore.getState().activeTab).toBe('dashboard');
  });

  test('walks back from a screen under More, then to Home', async () => {
    await unlockVault();
    const user = userEvent.setup();
    await renderApp();
    await openTab(user, 'Settings');
    expect(useAppStore.getState().activeTab).toBe('settings');

    await pressBack();
    expect(useAppStore.getState().activeTab).toBe('more');
    await pressBack();
    expect(useAppStore.getState().activeTab).toBe('dashboard');
  });

  test('saving a form still saves once and returns to the list', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openTab(user, 'Transactions');

    await user.click(await screen.findByRole('button', { name: 'Add transaction' }));
    await user.type(screen.getByLabelText('Amount'), '12.50');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    expect(await listTransactions()).toHaveLength(1);
    await waitFor(() => expect(history.state).toEqual({ tab: 'transactions' }));
  });

  test('moves focus to the main region when the screen changes', async () => {
    await unlockVault();
    const user = userEvent.setup();
    await renderApp();
    await openTab(user, 'Accounts');
    expect(document.activeElement).toBe(document.getElementById('main'));
  });
});
