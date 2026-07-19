import { render, screen } from '@testing-library/react';
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

/** Reset in-memory store to a fresh boot (locked) without wiping the database. */
export async function resetToLocked() {
  useAppStore.setState(initialState, true);
  await useAppStore.getState().init();
}
