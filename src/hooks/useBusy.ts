import { useRef, useState } from 'react';

/**
 * Guard an async action against re-entry (double-tapping Save). `run` ignores
 * calls made while one is still in flight; `busy` drives the disabled state.
 */
export function useBusy(): [boolean, (action: () => Promise<void>) => Promise<void>] {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // state alone lags a same-tick second tap

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return [busy, run];
}
