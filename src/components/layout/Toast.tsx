import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

const VISIBLE_MS = 4000;

/**
 * Brief confirmation that an action went through. The live region is always in
 * the DOM so screen readers announce the text when it changes; it never takes focus.
 */
export default function Toast() {
  const toast = useAppStore((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => useAppStore.setState({ toast: null }), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
