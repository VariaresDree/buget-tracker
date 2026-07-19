import type { CSSProperties } from 'react';

// Chart chrome stays in UI ink/surface tokens; series colors belong to the data.

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--surface)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: '0.85rem',
};

export const CHART_AXIS_TICK = { fill: 'var(--text-dim)', fontSize: 12 };
