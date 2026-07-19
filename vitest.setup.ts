import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Keep sync OFF in tests so nothing hits the network — even though Vite loads
// .env.local. isSyncConfigured() reads these at call-time and sees empty.
vi.stubEnv('VITE_SUPABASE_URL', '');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

// RTL only auto-registers cleanup when test globals exist; we run with
// globals: false, so unmount rendered components after every test ourselves.
afterEach(() => {
  cleanup();
});

// jsdom provides crypto.getRandomValues but not crypto.subtle — patch in Node's WebCrypto.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

// jsdom has no matchMedia; useTheme needs it. Default to dark (no light match).
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
