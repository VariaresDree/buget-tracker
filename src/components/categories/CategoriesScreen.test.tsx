import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { addCategory, listCategories } from '../../db/repo';
import { renderApp, renderUnlocked, resetApp, unlockVault } from '../../test/helpers';

beforeEach(resetApp);

async function openCategoriesTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Categories' }));
}

describe('CategoriesScreen', () => {
  test('adds an expense category with a monthly cap', async () => {
    const user = userEvent.setup();
    await renderUnlocked();
    await openCategoriesTab(user);

    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Food');
    await user.type(screen.getByLabelText('Monthly cap'), '5,000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(screen.getByText(/₱5,000\.00/)).toBeInTheDocument();

    const [category] = await listCategories();
    expect(category).toMatchObject({ name: 'Food', type: 'expense', monthlyCap: 500000 });
  });

  test('an empty cap field means no cap', async () => {
    const user = userEvent.setup();
    await renderUnlocked();
    await openCategoriesTab(user);

    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Misc');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Misc')).toBeInTheDocument();
    expect(screen.getByText('No cap')).toBeInTheDocument();
    expect((await listCategories())[0].monthlyCap).toBeNull();
  });

  test('income categories have no cap field', async () => {
    const user = userEvent.setup();
    await renderUnlocked();
    await openCategoriesTab(user);

    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Salary');
    await user.click(screen.getByLabelText('Income'));
    expect(screen.queryByLabelText('Monthly cap')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Salary')).toBeInTheDocument();
    expect((await listCategories())[0]).toMatchObject({ type: 'income', monthlyCap: null });
  });

  test('preset swatches set the category color', async () => {
    const user = userEvent.setup();
    await renderUnlocked();
    await openCategoriesTab(user);

    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Bills');
    await user.click(screen.getByRole('button', { name: 'Color option 3' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Bills');
    expect((await listCategories())[0].color).toBe('#c98500');
  });

  test('edits a category cap', async () => {
    await unlockVault();
    await addCategory({ name: 'Food', type: 'expense', monthlyCap: 500000, color: '#f97316' });
    const user = userEvent.setup();
    await renderApp();
    await openCategoriesTab(user);

    await user.click(await screen.findByRole('button', { name: 'Edit Food' }));
    const cap = screen.getByLabelText('Monthly cap');
    await user.clear(cap);
    await user.type(cap, '3,000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/₱3,000\.00/)).toBeInTheDocument();
    expect((await listCategories())[0].monthlyCap).toBe(300000);
  });

  test('deletes a category after confirmation', async () => {
    await unlockVault();
    await addCategory({ name: 'Food', type: 'expense', monthlyCap: null, color: '#f97316' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    await renderApp();
    await openCategoriesTab(user);

    await user.click(await screen.findByRole('button', { name: 'Delete Food' }));

    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument();
    expect(await listCategories()).toHaveLength(0);
  });
});
