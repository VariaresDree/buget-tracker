# Project: [budget tracker name]
Stack: React 19, Vite, Dexie.js, Zustand, vite-plugin-pwa, Recharts, Papaparse,
Supabase (sync only). No bank API integrations of any kind.

Offline-first, local-first. The only backend is an **opt-in, end-to-end
encrypted sync** (Supabase): the server stores one AES-GCM ciphertext blob per
user and can never see plaintext financial data. With sync off, the app is
fully client-only.

## Guardrails
- Never change a function signature or a Zustand store shape without
  updating every call site in the same change. Search the whole repo
  first, list all call sites, then edit.
- Offline-first: every write goes to IndexedDB first. Sync is additive and
  never blocks a local write.
- This app stores financial data. Transaction amounts and notes must be
  encrypted at rest in IndexedDB using a passphrase-derived key (Web
  Crypto API, PBKDF2 or Argon2 + AES-GCM). Never store the passphrase
  itself, only a derived key held in memory for the session.
- Sync is end-to-end encrypted: the vault is encrypted client-side with the
  passphrase-derived key BEFORE upload. The server (Supabase) only ever
  receives ciphertext + non-secret PBKDF2 params. Never send plaintext
  financial data or the passphrase off-device.
- No CSV import logic may execute remote requests — parsing is 100%
  local/client-side.