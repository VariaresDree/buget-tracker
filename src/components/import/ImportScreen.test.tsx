import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import { addAccount, commitImport, listImportPresets, listTransactions } from '../../db/repo';
import { computeImportHash } from '../../lib/csv/dedupe';
import { openTab, renderApp, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

const CSV = [
  'Statement for July',
  'Date,Description,Amount',
  '13/07/2026,Coffee Shop,-3.50',
  '20/07/2026,Grocery Mart,-45.00',
].join('\n');

function csvFile(text = CSV, name = 'stmt.csv') {
  return new File([text], name, { type: 'text/csv' });
}

async function openImport(user: ReturnType<typeof userEvent.setup>) {
  await openTab(user, 'Import');
}

async function toMapStep(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText('CSV file'), file);
  await screen.findByRole('heading', { name: 'Map columns' });
}

describe('CSV import', () => {
  test('imports normalized rows into the chosen account', async () => {
    await unlockVault();
    const acct = await addAccount({ name: 'BPI', type: 'bank', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openImport(user);

    await toMapStep(user, csvFile());
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    await screen.findByRole('heading', { name: 'Review import' });
    expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
    expect(screen.getByText('-₱3.50')).toBeInTheDocument();
    expect(screen.getByText('2026-07-13')).toBeInTheDocument();
    expect(screen.getByText('-₱45.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import 2 transactions' }));

    expect(await screen.findByText(/imported 2 transactions/i)).toBeInTheDocument();
    const txs = await listTransactions({ accountId: acct });
    expect(txs.map((t) => t.amount).sort((a, b) => a - b)).toEqual([-4500, -350]);
    expect(txs.find((t) => t.amount === -350)).toMatchObject({
      date: '2026-07-13',
      note: 'Coffee Shop',
    });
  });

  test('flags duplicates and imports only new rows', async () => {
    await unlockVault();
    const acct = await addAccount({ name: 'BPI', type: 'bank', startingBalance: 0 });
    const dupHash = await computeImportHash(acct, '2026-07-13', -350, 'Coffee Shop');
    await commitImport(acct, [
      { date: '2026-07-13', amount: -350, note: 'Coffee Shop', importHash: dupHash },
    ]);
    const user = userEvent.setup();
    await renderApp();
    await openImport(user);

    await toMapStep(user, csvFile());
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    await screen.findByRole('heading', { name: 'Review import' });
    const dupRow = screen.getByText('Coffee Shop').closest('li')!;
    expect(within(dupRow).getByText(/duplicate/i)).toBeInTheDocument();
    expect(within(dupRow).getByRole('checkbox')).not.toBeChecked();

    // Only the new row is pre-selected.
    await user.click(screen.getByRole('button', { name: 'Import 1 transaction' }));

    expect(await screen.findByText(/imported 1 transaction/i)).toBeInTheDocument();
    const txs = await listTransactions({ accountId: acct });
    expect(txs).toHaveLength(2); // pre-seeded + the one new row
    expect(txs.filter((t) => t.amount === -350)).toHaveLength(1);
  });

  test('marks rows with unparseable data as skipped and excludes them', async () => {
    await unlockVault();
    await addAccount({ name: 'BPI', type: 'bank', startingBalance: 0 });
    const badCsv = [
      'Date,Description,Amount',
      '13/07/2026,Good Row,-3.50',
      'not-a-date,Bad Row,-9.99',
    ].join('\n');
    const user = userEvent.setup();
    await renderApp();
    await openImport(user);

    await toMapStep(user, csvFile(badCsv));
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    await screen.findByRole('heading', { name: 'Review import' });
    const badRow = screen.getByText('Bad Row').closest('li')!;
    expect(within(badRow).getByText(/skipped/i)).toBeInTheDocument();
    expect(within(badRow).queryByRole('checkbox')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Import 1 transaction' }));
    expect(await screen.findByText(/imported 1 transaction/i)).toBeInTheDocument();
    expect(await listTransactions()).toHaveLength(1);
  });

  test('saves the column mapping as a reusable preset', async () => {
    await unlockVault();
    await addAccount({ name: 'BPI', type: 'bank', startingBalance: 0 });
    const user = userEvent.setup();
    await renderApp();
    await openImport(user);

    await toMapStep(user, csvFile());
    await user.type(screen.getByLabelText('Preset name'), 'BPI statements');
    await user.click(screen.getByRole('button', { name: 'Save preset' }));

    await screen.findByText(/preset saved/i);
    const presets = await listImportPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      name: 'BPI statements',
      mapping: { date: 0, description: 1, amount: 2 },
    });
  });
});
