import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** What the toggle reveals, for its label: "passphrase" or "password". */
  what?: string;
}

/** A secret field with a show/hide toggle, so it need not be typed blind. */
export default function PassphraseInput({ what = 'passphrase', ...input }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="passphrase-field">
      <input {...input} type={shown ? 'text' : 'password'} />
      <button
        type="button"
        className="icon-btn"
        aria-label={shown ? `Hide ${what}` : `Show ${what}`}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
