import { render, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import App from '../App';
import { db } from '../db/db';
import { useAppStore } from '../store/useAppStore';

export const PASSPHRASE = 'correct horse battery';

const initialState = useAppStore.getState();

/** Wipe the database and reset the store to a fresh-boot state. */
export async function resetApp() {
  useAppStore.setState(initialState, true);
  await db.delete();
  await db.open();
}

/** Create a vault; leaves the store unlocked so repo seeds can run. */
export async function unlockVault() {
  await useAppStore.getState().setupPassphrase(PASSPHRASE);
}

/** Render the app shell (vault must already be unlocked). */
export async function renderApp() {
  render(<App />);
  await screen.findByRole('button', { name: 'Lock' });
}

/** Create a vault (leaves the store unlocked) and render the app shell. */
export async function renderUnlocked() {
  await unlockVault();
  await renderApp();
}

/** Screens reached through the "More" tab (bottom nav is capped at 5). */
const UNDER_MORE = new Set(['Recurring', 'Import', 'Settings']);
/** Tab labels that differ from the screen name. */
const TAB_LABEL: Record<string, string> = { Dashboard: 'Home', Categories: 'Budgets' };

/**
 * Navigate to a screen by its name, hopping through "More" when it's nested.
 * Keeps tests decoupled from the bottom-nav layout.
 */
export async function openTab(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<void> {
  if (UNDER_MORE.has(name)) {
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('button', { name }));
    return;
  }
  await user.click(screen.getByRole('button', { name: TAB_LABEL[name] ?? name }));
}

/** Reset in-memory store to a fresh boot (locked) without wiping the database. */
export async function resetToLocked() {
  useAppStore.setState(initialState, true);
  await useAppStore.getState().init();
}
