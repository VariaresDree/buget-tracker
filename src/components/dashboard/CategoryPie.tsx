import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { PieSlice } from '../../lib/charts';
import { formatMoney } from '../../lib/money';
import { CHART_TOOLTIP_STYLE } from './chartTheme';

interface Props {
  slices: PieSlice[];
  symbol: string;
  /** Explicit size skips ResponsiveContainer (used by tests; jsdom can't measure). */
  width?: number;
  height?: number;
}

export default function CategoryPie({ slices, symbol, width, height = 220 }: Props) {
  if (slices.length === 0) {
    return <p className="placeholder">No spending this month.</p>;
  }

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const chart = (
    <PieChart width={width} height={height}>
      <Pie
        data={slices}
        dataKey="value"
        nameKey="name"
        innerRadius="55%"
        outerRadius="90%"
        // 2px surface gap between fills (mark spec) — identity never rests on
        // color alone; the legend below carries names and values.
        stroke="var(--surface)"
        strokeWidth={2}
        isAnimationActive={false}
      >
        {slices.map((slice) => (
          <Cell key={slice.name} fill={slice.color} />
        ))}
      </Pie>
      <Tooltip
        formatter={(value) => formatMoney(Number(value), symbol)}
        contentStyle={CHART_TOOLTIP_STYLE}
      />
    </PieChart>
  );

  return (
    <div className="chart-box">
      {width ? (
        chart
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {chart}
        </ResponsiveContainer>
      )}
      <ul className="chart-legend" aria-label="Category spend legend">
        {slices.map((slice) => (
          <li key={slice.name}>
            <span className="color-dot" style={{ background: slice.color }} />
            <span className="legend-name">{slice.name}</span>
            <span className="muted">{Math.round((slice.value / total) * 100)}%</span>
            <span className="amount">{formatMoney(slice.value, symbol)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
