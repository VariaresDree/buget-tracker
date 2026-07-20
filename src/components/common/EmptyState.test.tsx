import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wallet } from 'lucide-react';
import { describe, expect, test, vi } from 'vitest';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  test('renders the headline and hint', () => {
    render(<EmptyState icon={Wallet} title="No accounts yet" hint="Add your first one." />);
    expect(screen.getByRole('heading', { name: 'No accounts yet' })).toBeInTheDocument();
    expect(screen.getByText('Add your first one.')).toBeInTheDocument();
  });

  test('offers a call to action when one is supplied', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState icon={Wallet} title="No accounts yet" actionLabel="Add account" onAction={onAction} />,
    );

    await user.click(screen.getByRole('button', { name: 'Add account' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  test('renders no button when there is nothing to do', () => {
    render(<EmptyState icon={Wallet} title="No transactions yet" hint="Nothing here." />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
