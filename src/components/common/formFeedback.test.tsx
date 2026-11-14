import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import { addAccount } from '../../db/repo';
import { openTab, renderApp, resetApp, unlockVault } from '../../test/helpers';
import App from '../../App';

beforeEach(resetApp);

describe('field errors', () => {
  test('appear at the field, are announced, and take focus', async () => {
    await unlockVault();
    await addAccount({ name: 'Wallet', type: 'cash', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openTab(user, 'Transactions');
    await user.click(await screen.findByRole('button', { name: 'Add transaction' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const amount = screen.getByLabelText('Amount');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Enter an amount greater than zero.');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveAttribute('aria-describedby', alert.id);
    expect(amount).toHaveFocus();
    // Directly under its field, not at the bottom of the form.
    expect(amount.nextElementSibling).toBe(alert);
  });
});

describe('passphrase fields', () => {
  test('can be shown and hidden while setting up', async () => {
    const user = userEvent.setup();
    render(<App />);
    const field = await screen.findByLabelText('Passphrase');
    expect(field).toHaveAttribute('type', 'password');

    const [toggle] = screen.getAllByRole('button', { name: 'Show passphrase' });
    await user.click(toggle);
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide passphrase' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The confirm field has its own, independent toggle.
    expect(screen.getByLabelText('Confirm passphrase')).toHaveAttribute('type', 'password');
  });

  test('a mismatch is reported on the confirm field', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Passphrase'), 'correct horse battery');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'something else entirely');
    await user.click(screen.getByRole('button', { name: /create passphrase/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passphrases do not match.');
    expect(screen.getByLabelText('Confirm passphrase')).toHaveFocus();
  });
});

describe('confirmation toast', () => {
  test('confirms a save in a polite live region without taking focus', async () => {
    await unlockVault();
    const user = userEvent.setup();
    await renderApp();
    await openTab(user, 'Accounts');
    await user.click(await screen.findByRole('button', { name: 'Add account' }));
    await user.type(screen.getByLabelText('Name'), 'Wallet');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const region = screen.getByRole('status');
    await waitFor(() => expect(region).toHaveTextContent('Account saved'));
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).not.toContainElement(document.activeElement as HTMLElement);
  });
});
