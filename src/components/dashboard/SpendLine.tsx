import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SpendPoint } from '../../lib/charts';
import { formatMoney } from '../../lib/money';
import { CHART_AXIS_TICK, CHART_TOOLTIP_STYLE } from './chartTheme';

interface Props {
  series: SpendPoint[];
  symbol: string;
  /** Explicit size skips ResponsiveContainer (used by tests; jsdom can't measure). */
  width?: number;
  height?: number;
}

export default function SpendLine({ series, symbol, width, height = 200 }: Props) {
  const hasSpend = series.length > 0 && series[series.length - 1].total > 0;
  if (!hasSpend) {
    return <p className="placeholder">No spending this month.</p>;
  }

  const chart = (
    <LineChart width={width} height={height} data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
      <CartesianGrid stroke="var(--surface-2)" vertical={false} />
      <XAxis
        dataKey="day"
        tick={CHART_AXIS_TICK}
        tickLine={false}
        axisLine={{ stroke: 'var(--surface-2)' }}
        interval="preserveStartEnd"
      />
      <YAxis
        tick={CHART_AXIS_TICK}
        tickLine={false}
        axisLine={false}
        width={58}
        tickFormatter={(value: number) =>
          `${symbol}${Math.round(value / 100).toLocaleString('en-US')}`
        }
      />
      <Tooltip
        labelFormatter={(day) => `Day ${day}`}
        formatter={(value) => [formatMoney(Number(value), symbol), 'Spent so far']}
        contentStyle={CHART_TOOLTIP_STYLE}
      />
      <Line
        type="monotone"
        dataKey="total"
        stroke="var(--accent)"
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 5 }}
        isAnimationActive={false}
      />
    </LineChart>
  );

  if (width) return <div className="chart-box">{chart}</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={height}>
        {chart}
      </ResponsiveContainer>
    </div>
  );
}
