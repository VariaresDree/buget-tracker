import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  /** Headline — keep wording stable; tests and users both key off it. */
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/** Empty states get an icon, a headline, a hint, and a way forward. */
export default function EmptyState({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <Icon size={26} strokeWidth={1.75} />
      </span>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {actionLabel && onAction && (
        <button className="btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {secondaryLabel && onSecondary && (
        <button className="secondary" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}
