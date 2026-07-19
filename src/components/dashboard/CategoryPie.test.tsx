import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import CategoryPie from './CategoryPie';

const SLICES = [
  { name: 'Food', value: 250000, color: '#3987e5' },
  { name: 'Transport', value: 50000, color: '#199e70' },
];

describe('CategoryPie', () => {
  test('draws a sector per slice with a name+value legend', () => {
    const { container } = render(
      <CategoryPie slices={SLICES} symbol="₱" width={400} height={240} />,
    );
    expect(container.querySelectorAll('.recharts-pie-sector')).toHaveLength(2);

    const legend = screen.getByRole('list', { name: 'Category spend legend' });
    expect(legend).toHaveTextContent('Food');
    expect(legend).toHaveTextContent('₱2,500.00');
    expect(legend).toHaveTextContent('Transport');
    expect(legend).toHaveTextContent('₱500.00');
    // Percentages give the part-of-whole reading without labeling every mark.
    expect(legend).toHaveTextContent('83%');
    expect(legend).toHaveTextContent('17%');
  });

  test('shows an empty state instead of an empty pie', () => {
    const { container } = render(
      <CategoryPie slices={[]} symbol="₱" width={400} height={240} />,
    );
    expect(screen.getByText(/no spending this month/i)).toBeInTheDocument();
    expect(container.querySelector('.recharts-pie-sector')).toBeNull();
  });
});
