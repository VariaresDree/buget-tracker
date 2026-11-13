import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../db/db';
import { addAccount, deleteAccount, exportBackup, listAccounts } from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';
import { openTab, renderApp, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

async function openSettingsTab(user: ReturnType<typeof userEvent.setup>) {
  await openTab(user, 'Settings');
}

describe('SettingsScreen', () => {
  test('updates the currency symbol', async () => {
    await unlockVault();
    const user = userEvent.setup();
    await renderApp();
    await openSettingsTab(user);

    const symbol = screen.getByLabelText('Currency symbol');
    await user.clear(symbol);
    await user.type(symbol, '$');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByText(/settings saved/i)).toBeInTheDocument();
    expect(useAppStore.getState().settings.currencySymbol).toBe('$');
  });

  test('changes the theme preference', async () => {
    await unlockVault();
    const user = userEvent.setup();
    await renderApp();
    await openSettingsTab(user);

    const theme = screen.getByLabelText('Theme');
    await user.selectOptions(theme, within(theme).getByRole('option', { name: 'Light' }));
    expect(useAppStore.getState().settings.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('changes the passphrase — old fails, new unlocks, data intact', async () => {
    await unlockVault();
    await addAccount({ name: 'Keeper', type: 'bank', startingBalance: 12300 });
    const user = userEvent.setup();
    await renderApp();
    await openSettingsTab(user);

    await user.click(screen.getByRole('button', { name: 'Change passphrase' }));
    await user.type(screen.getByLabelText('Current passphrase'), 'correct horse battery');
    await user.type(screen.getByLabelText('New passphrase'), 'my new secret phrase');
    await user.type(screen.getByLabelText('Confirm new passphrase'), 'my new secret phrase');
    await user.click(screen.getByRole('button', { name: 'Update passphrase' }));

    expect(await screen.findByText(/passphrase changed/i)).toBeInTheDocument();

    const { resetToLocked } = await import('../../test/helpers');
    await resetToLocked();
    expect(await useAppStore.getState().unlock('correct horse battery')).toBe(false);
    expect(await useAppStore.getState().unlock('my new secret phrase')).toBe(true);
    expect((await listAccounts())[0]).toMatchObject({ name: 'Keeper', startingBalance: 12300 });
  });

  test('rejects a wrong current passphrase', async () => {
    await unlockVault();
    const user = userEvent.setup();
    await renderApp();
    await openSettingsTab(user);

    await user.click(screen.getByRole('button', { name: 'Change passphrase' }));
    await user.type(screen.getByLabelText('Current passphrase'), 'wrong one here');
    await user.type(screen.getByLabelText('New passphrase'), 'my new secret phrase');
    await user.type(screen.getByLabelText('Confirm new passphrase'), 'my new secret phrase');
    await user.click(screen.getByRole('button', { name: 'Update passphrase' }));

    expect(await screen.findByText(/incorrect/i)).toBeInTheDocument();
  });

  test('restores an uploaded backup and re-locks the vault', async () => {
    await unlockVault();
    await addAccount({ name: 'Restored Bank', type: 'bank', startingBalance: 42000 });
    const backup = await exportBackup();

    const user = userEvent.setup();
    await renderApp();
    await openSettingsTab(user);

    // Import replaces data and re-locks; confirm the destructive action.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const file = new File([backup], 'backup.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Restore from backup'), file);

    // Vault re-locks after restore.
    expect(await screen.findByRole('heading', { name: 'Unlock' })).toBeInTheDocument();
    expect(useAppStore.getState().sessionKey).toBeNull();

    // Data survived the round trip.
    await useAppStore.getState().unlock('correct horse battery');
    expect((await listAccounts())[0]).toMatchObject({ name: 'Restored Bank', startingBalance: 42000 });
  });

  test('restores the pre-sync snapshot, keeps the sync version, and re-locks', async () => {
    await unlockVault();
    const before = await addAccount({ name: 'Before Sync', type: 'cash', startingBalance: 5000 });
    const snapshot = await exportBackup();

    // Simulate a sync pull that replaced local data after saving the snapshot.
    await deleteAccount(before);
    await addAccount({ name: 'After Sync', type: 'bank', startingBalance: 100 });
    await db.meta.put({ key: 'sync-safety', value: { json: snapshot, at: Date.now() } });
    await db.meta.put({ key: 'sync', value: { version: 7 } });

    const user = userEvent.setup();
    await renderApp();
    await openSettingsTab(user);
    const restore = await screen.findByRole('button', { name: /restore pre-sync snapshot/i });

    // Declining leaves everything as it is.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(restore);
    expect((await listAccounts()).map((a) => a.name)).toEqual(['After Sync']);

    confirm.mockReturnValue(true);
    await user.click(restore);
    expect(await screen.findByRole('heading', { name: 'Unlock' })).toBeInTheDocument();
    expect(useAppStore.getState().sessionKey).toBeNull();

    await useAppStore.getState().unlock('correct horse battery');
    expect((await listAccounts()).map((a) => a.name)).toEqual(['Before Sync']);
    // The current server version survives, so the next sync won't pull over the restore.
    expect((await db.meta.get('sync'))?.value).toEqual({ version: 7 });
  });
});
