import { ArrowLeft } from 'lucide-react';

interface Props {
  title: string;
  /** Omit where there is nothing to go back to (e.g. a wizard step). */
  onBack?: () => void;
}

/** Form title with a back arrow, so leaving never depends on scrolling to Cancel. */
export default function FormHeader({ title, onBack }: Props) {
  return (
    <div className="form-head">
      {onBack && (
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
      )}
      <h2>{title}</h2>
    </div>
  );
}
