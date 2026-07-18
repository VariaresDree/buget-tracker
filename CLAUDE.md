# Project: [budget tracker name]
Stack: React 19, Vite, Dexie.js, Zustand, vite-plugin-pwa, Recharts, Papaparse.
Client-only PWA, no backend, no bank API integrations of any kind.

## Guardrails
- Never change a function signature or a Zustand store shape without
  updating every call site in the same change. Search the whole repo
  first, list all call sites, then edit.
- Offline-first: every write goes to IndexedDB first.
- This app stores financial data. Transaction amounts and notes must be
  encrypted at rest in IndexedDB using a passphrase-derived key (Web
  Crypto API, PBKDF2 or Argon2 + AES-GCM). Never store the passphrase
  itself, only a derived key held in memory for the session.
- No CSV import logic may execute remote requests — parsing is 100%
  local/client-side.