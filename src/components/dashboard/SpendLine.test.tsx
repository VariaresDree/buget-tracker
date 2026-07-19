import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import SpendLine from './SpendLine';

describe('SpendLine', () => {
  test('draws the cumulative spend line', () => {
    const series = [
      { day: 1, total: 1000 },
      { day: 2, total: 1000 },
      { day: 3, total: 2500 },
    ];
    const { container } = render(
      <SpendLine series={series} symbol="₱" width={400} height={200} />,
    );
    expect(container.querySelector('.recharts-line-curve')).not.toBeNull();
  });

  test('shows an empty state when the month has no spend', () => {
    const flat = [
      { day: 1, total: 0 },
      { day: 2, total: 0 },
    ];
    const { container } = render(
      <SpendLine series={flat} symbol="₱" width={400} height={200} />,
    );
    expect(screen.getByText(/no spending this month/i)).toBeInTheDocument();
    expect(container.querySelector('.recharts-line-curve')).toBeNull();
  });
});
