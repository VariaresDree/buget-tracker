import { useState } from 'react';

export interface FormError {
  /** The id of the input the message belongs to. */
  field: string;
  message: string;
}

/**
 * One validation error at a time, tied to the field it is about: `fail` records
 * it and moves focus there; `invalid` gives that input its ARIA attributes.
 */
export function useFieldError() {
  const [error, setError] = useState<FormError | null>(null);
  return {
    error,
    clear: () => setError(null),
    fail(field: string, message: string) {
      setError({ field, message });
      document.getElementById(field)?.focus();
    },
    invalid: (field: string) =>
      error?.field === field
        ? { 'aria-invalid': true as const, 'aria-describedby': `${field}-error` }
        : {},
  };
}

interface Props {
  error: FormError | null;
  field: string;
}

/** The message, placed directly under its field and announced when it appears. */
export default function FieldError({ error, field }: Props) {
  if (error?.field !== field) return null;
  return (
    <p className="form-error" id={`${field}-error`} role="alert">
      {error.message}
    </p>
  );
}
