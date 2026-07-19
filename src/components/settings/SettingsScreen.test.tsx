import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { addAccount, exportBackup, listAccounts } from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';
import { renderApp, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

async function openSettingsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Settings' }));
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
});
