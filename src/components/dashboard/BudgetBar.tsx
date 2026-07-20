import { formatMoney } from '../../lib/money';

interface Props {
  name: string;
  color: string;
  spent: number;
  cap: number | null;
  remaining: number | null;
  over: boolean;
  symbol: string;
}

export default function BudgetBar({ name, color, spent, cap, remaining, over, symbol }: Props) {
  const pct = cap === null || cap === 0 ? 0 : Math.min(100, (spent / cap) * 100);

  return (
    <li className={over ? 'budget-row over' : 'budget-row'}>
      <div className="budget-row-top">
        <strong>
          <span className="color-dot" style={{ background: color }} />
          {name}
        </strong>
        <span>
          <span className="amount">{formatMoney(spent, symbol)}</span>
          {cap !== null && <span className="muted"> of {formatMoney(cap, symbol)}</span>}
        </span>
      </div>
      {cap !== null ? (
        <>
          <div
            className="budget-track"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${name} budget used`}
          >
            {/* scaleX keeps the animation on the compositor (no layout) */}
            <div
              className="budget-fill"
              style={{
                width: '100%',
                transform: `scaleX(${pct / 100})`,
                background: over ? 'var(--danger)' : color,
              }}
            />
          </div>
          <span className={over ? 'form-error' : 'muted'}>
            {over
              ? `Over by ${formatMoney(-(remaining ?? 0), symbol)}`
              : `${formatMoney(remaining ?? 0, symbol)} left`}
          </span>
        </>
      ) : (
        <span className="muted">No cap</span>
      )}
    </li>
  );
}
