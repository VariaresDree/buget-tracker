import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import App from './App';
import { db } from './db/db';
import { useAppStore } from './store/useAppStore';

const initialState = useAppStore.getState();

beforeEach(async () => {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
});

const PASSPHRASE = 'correct horse battery';

/** Create a vault, then reset in-memory state to simulate a fresh page load. */
async function seedVault() {
  await useAppStore.getState().setupPassphrase(PASSPHRASE);
  useAppStore.setState(initialState, true);
}

async function fillSetupForm(user: ReturnType<typeof userEvent.setup>, pass: string, confirm: string) {
  await screen.findByRole('heading', { name: /set up your passphrase/i });
  await user.type(screen.getByLabelText('Passphrase'), pass);
  await user.type(screen.getByLabelText('Confirm passphrase'), confirm);
  await user.click(screen.getByRole('button', { name: /create passphrase/i }));
}

describe('first run', () => {
  test('shows the setup screen', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /set up your passphrase/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot be recovered/i)).toBeInTheDocument();
  });

  test('rejects mismatched passphrases', async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillSetupForm(user, PASSPHRASE, 'something else entirely');
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
  });

  test('rejects a passphrase under 8 characters', async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillSetupForm(user, 'short', 'short');
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  test('creates the vault and lands unlocked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillSetupForm(user, PASSPHRASE, PASSPHRASE);
    expect(await screen.findByRole('button', { name: 'Lock' })).toBeInTheDocument();
  });
});

describe('unlocking an existing vault', () => {
  test('shows the unlock screen, not setup', async () => {
    await seedVault();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Unlock' })).toBeInTheDocument();
    expect(screen.queryByText(/set up your passphrase/i)).not.toBeInTheDocument();
  });

  test('unlocks with the correct passphrase', async () => {
    await seedVault();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Unlock' });
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('button', { name: 'Lock' })).toBeInTheDocument();
  });

  test('shows an error for a wrong passphrase and stays locked', async () => {
    await seedVault();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Unlock' });
    await user.type(screen.getByLabelText('Passphrase'), 'totally wrong thing');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText(/wrong passphrase/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
  });
});

describe('locking', () => {
  test('the lock button returns to the unlock screen', async () => {
    await seedVault();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Unlock' });
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await user.click(await screen.findByRole('button', { name: 'Lock' }));
    expect(await screen.findByRole('heading', { name: 'Unlock' })).toBeInTheDocument();
    expect(useAppStore.getState().sessionKey).toBeNull();
  });

  test('auto-locks after the configured idle time', async () => {
    await seedVault();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Unlock' });
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await screen.findByRole('button', { name: 'Lock' });

    // Shrink the idle timeout to ~60ms and wait for the auto-lock to fire.
    act(() => {
      useAppStore.setState((s) => ({
        settings: { ...s.settings, autoLockMinutes: 0.001 },
      }));
    });
    expect(await screen.findByRole('heading', { name: 'Unlock' })).toBeInTheDocument();
    expect(useAppStore.getState().sessionKey).toBeNull();
  });
});
