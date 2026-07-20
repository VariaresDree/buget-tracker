import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { renderApp, renderUnlocked, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

describe('bottom navigation', () => {
  test('shows exactly five top-level tabs', async () => {
    await renderUnlocked();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const tabs = within(nav).getAllByRole('button');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Home',
      'Transactions',
      'Accounts',
      'Budgets',
      'More',
    ]);
  });

  test('More reveals the secondary destinations and navigates to them', async () => {
    const user = userEvent.setup();
    await renderUnlocked();

    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('button', { name: 'Recurring' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(useAppStore.getState().activeTab).toBe('settings');
  });

  test('the More tab stays highlighted while on a nested screen', async () => {
    const user = userEvent.setup();
    await renderUnlocked();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('button', { name: 'Import' }));

    const nav = screen.getByRole('navigation', { name: 'Main' });
    const moreTab = within(nav).getByRole('button', { name: 'More' });
    expect(moreTab).toHaveAttribute('aria-current', 'page');
  });

  test('the quick-add button jumps to Transactions and opens the form', async () => {
    // Regression: the screen mounts *after* the request, so a mount-time
    // snapshot of the signal would miss it entirely.
    const { addAccount } = await import('../../db/repo');
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole('button', { name: 'Quick add transaction' }));

    expect(await screen.findByLabelText('Amount')).toBeInTheDocument();
    expect(useAppStore.getState().activeTab).toBe('transactions');
    expect(useAppStore.getState().pendingQuickAdd).toBe(false);
  });

  test('Lock now locks the vault from the More screen', async () => {
    const user = userEvent.setup();
    await renderUnlocked();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('button', { name: 'Lock now' }));

    expect(await screen.findByRole('heading', { name: 'Unlock' })).toBeInTheDocument();
    expect(useAppStore.getState().sessionKey).toBeNull();
  });
});
