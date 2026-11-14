import { useEffect, useRef } from 'react';

/**
 * Make the phone's back button/gesture close an open form instead of leaving
 * the app. While `open`, one history entry stands for the form: Back pops it
 * and calls `onClose`; closing from the UI (Cancel/Save) pops it for us.
 */
export function useBackClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Whether our entry is on the stack. A ref (not effect-local) so StrictMode's
  // double-invoked effect cannot push twice.
  const owned = useRef(false);

  useEffect(() => {
    if (!open) {
      if (owned.current) {
        owned.current = false;
        history.back(); // closed from the UI: drop our entry
      }
      return;
    }
    if (!owned.current) {
      owned.current = true;
      history.pushState({ ...(history.state as object | null), overlay: true }, '');
    }
    const onPop = () => {
      owned.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);
}
