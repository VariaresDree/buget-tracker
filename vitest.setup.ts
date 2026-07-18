import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
