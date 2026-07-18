# Budget Tracker — Build Plan

Stack: React 19, Vite, TypeScript, Dexie.js, Zustand, vite-plugin-pwa, Recharts, Papaparse.
Client-only offline-first PWA. Single user. No backend, no bank APIs. Vitest + React Testing Library + fake-indexeddb for tests (same toolchain as the habit tracker).

Scope decisions (confirmed):
- Transfers between accounts are first-class (linked transaction pair, excluded from spend/income stats)
- Single currency, symbol/code configurable in Settings
- Income and expense transactions; budget caps apply to expense categories only
- Money stored as integers in minor units (no floats)

## 1. Folder / file structure

```
buget-tracker/
├── plan.md
├── CLAUDE.md
├── index.html
├── package.json / tsconfig.json / vite.config.ts / vitest.setup.ts
├── public/icons/                  # PWA icons
└── src/
    ├── main.tsx / App.tsx
    ├── styles/app.css
    ├── db/
    │   ├── db.ts                  # Dexie schema + versions
    │   └── repo.ts                # ALL IndexedDB reads/writes; does envelope crypto internally
    ├── crypto/
    │   ├── keys.ts                # PBKDF2 derivation, keycheck create/verify
    │   └── envelope.ts            # AES-GCM encryptField/decryptField helpers
    ├── lib/
    │   ├── dates.ts               # local YYYY-MM-DD helpers, month ranges
    │   ├── money.ts               # minor-units parse/format with currency symbol
    │   ├── budgets.ts             # spend vs cap per category per month
    │   ├── recurrence.ts          # next-occurrence math, catch-up computation
    │   └── csv/
    │       ├── parse.ts           # encoding detection + Papaparse wrapper (100% local)
    │       ├── normalize.ts       # header/date/amount normalization heuristics
    │       └── presets.ts         # saved per-bank column mappings
    ├── store/useAppStore.ts       # Zustand store (session key, caches, UI)
    ├── hooks/                     # useTransactions(range), useBalances, ...
    └── components/
        ├── layout/                # AppShell, TabBar, lock gate
        ├── lock/                  # SetupPassphraseScreen, UnlockScreen
        ├── accounts/              # AccountsScreen, AccountForm
        ├── transactions/          # TransactionsScreen, TransactionForm, TransferForm
        ├── categories/            # CategoriesScreen, CategoryForm
        ├── dashboard/             # DashboardScreen, BudgetBar, CategoryPie, SpendLine
        ├── import/                # ImportScreen, ColumnMapper, ImportPreview
        ├── recurring/             # RecurringScreen, RecurringForm
        └── settings/              # SettingsScreen, ReloadPrompt
```

Tests colocated as `*.test.ts(x)` next to source, like the habit tracker.

## 2. Dexie schema

Encrypted fields (marked 🔒) are stored as `{iv, ct}` base64 AES-GCM envelopes — they can never be indexed; all indexes are on plaintext metadata. Dates, account/category links stay plaintext (per spec, secrets are amounts + notes), so filtered queries stay fast; sums/balances are computed in memory after unlock.

| Table | Index string | Fields |
|---|---|---|
| `accounts` | `'++id, name, type'` | name; type `cash\|ewallet\|bank\|credit`; 🔒`startingBalanceEnc`; `archived`; `createdAt` |
| `categories` | `'++id, name, type'` | name; type `expense\|income`; 🔒`monthlyCapEnc` (null = no cap); `color`; `archived` |
| `transactions` | `'++id, date, accountId, categoryId, [accountId+date], transferGroupId, importHash'` | `date` local `YYYY-MM-DD`; `accountId`; `categoryId` (null on transfer legs); 🔒`amountEnc` (signed minor units: + income, − expense); 🔒`noteEnc`; `transferGroupId` (uuid shared by the 2 legs, else null); `recurringRuleId?`; `importHash` (SHA-256 dedupe key); `createdAt` |
| `recurringRules` | `'++id, nextRunDate, active'` | `accountId`; `categoryId`; 🔒`amountEnc`; 🔒`noteEnc`; freq `daily\|weekly\|monthly` + `interval`; `startDate`; `nextRunDate`; `endDate?`; `active` |
| `importPresets` | `'++id, name'` | column→field `mapping`; `dateFormat`; `amountStyle`; `encoding` |
| `meta` | `'key'` | kv rows: `kdfParams` {saltB64, iterations, hash}; `keycheck` (encrypted sentinel to verify passphrase); `settings` {currencyCode, currencySymbol, theme, autoLockMinutes}; `schemaVersion` |

Note: CLAUDE.md's minimum is transaction amounts + notes; starting balances and budget caps are also money, so they get the same envelope (no extra cost — the whole app sits behind the unlock gate anyway).

## 3. Zustand store shape + session key handling

```ts
interface AppState {
  // --- session slice (NEVER persisted anywhere) ---
  lockStatus: 'uninitialized' | 'locked' | 'unlocked';
  sessionKey: CryptoKey | null;          // AES-GCM-256, extractable: false
  setupPassphrase(p: string): Promise<void>;   // derive, store kdfParams+keycheck, unlock
  unlock(p: string): Promise<boolean>;         // derive → verify keycheck → set key + load caches
  lockNow(): void;                             // key = null, wipe decrypted caches

  // --- decrypted in-memory caches (small tables only) ---
  accounts: Account[];                   // with decrypted startingBalance
  categories: Category[];                // with decrypted monthlyCap
  settings: Settings;
  reloadAccounts / reloadCategories / saveSettings ...;
  // transactions are NOT cached globally — loaded per view via useTransactions(range)

  // --- ui slice ---
  activeTab: 'dashboard' | 'transactions' | 'accounts' | 'import' | 'settings';
  ...form/editing state
}
```

Key lifecycle:
- Derivation: PBKDF2-SHA-256, ~600k iterations (OWASP), random 16-byte salt → AES-GCM-256 `CryptoKey` with `extractable: false` (raw bytes cannot be read out even from memory). Passphrase string is never stored; kdfParams + keycheck live in `meta`.
- Wrong-passphrase detection: decrypt the `keycheck` sentinel; GCM auth failure ⇒ reject.
- Held only in the Zustand store — no persist middleware touches the session slice; nothing in localStorage/sessionStorage.
- Cleared by: manual lock button → `lockNow()`; auto-lock after N idle minutes (setting); tab close/refresh clears it naturally (app always opens locked).
- Components never see ciphertext: `repo.ts` encrypts/decrypts internally using a `getSessionKey()` accessor that throws if locked.
- Changing passphrase (Settings) = derive new key, re-encrypt all 🔒 fields in one Dexie transaction.

## 4. Components and responsibilities

- **AppShell / TabBar** — layout + tab nav; renders UnlockScreen/SetupPassphraseScreen instead of content while locked; lock button; idle timer.
- **SetupPassphraseScreen** — first run: choose passphrase + confirm, explicit "unrecoverable if forgotten" warning.
- **UnlockScreen** — passphrase entry, wrong-passphrase error state.
- **DashboardScreen** — current-month overview with month selector: per-expense-category **BudgetBar** rows (spent vs cap vs remaining, over-budget highlight), income/spend totals, **CategoryPie** (Recharts pie of month's expenses by category), **SpendLine** (Recharts line of daily or cumulative spend over time).
- **AccountsScreen / AccountForm** — CRUD accounts (name, type, starting balance); shows computed current balance per account (starting balance + signed sums incl. transfers).
- **TransactionsScreen** — date-grouped list, filters by account/category/month; edit/delete.
- **TransactionForm** — amount, account, category, date, note, "make recurring" toggle (creates a rule).
- **TransferForm** — from-account, to-account, amount, date, note → writes the linked pair atomically.
- **CategoriesScreen / CategoryForm** — CRUD categories, type, monthly cap, color.
- **RecurringScreen / RecurringForm** — list rules with next-run date, pause/resume/delete.
- **ImportScreen → ColumnMapper → ImportPreview** — CSV pipeline UI (section 5): pick file + target account, map columns (or apply saved preset), preview normalized rows with dedupe flags, commit selected.
- **SettingsScreen** — currency symbol/code, theme (light/dark/system), auto-lock timeout, change passphrase, encrypted backup export/import (JSON of raw envelopes — restorable with the same passphrase).
- **ReloadPrompt** — PWA update prompt (same pattern as habit tracker).

## 5. CSV import strategy

Pipeline: file → encoding detection → Papaparse → header detection → column mapping (auto-guess + user confirm, saveable preset) → normalization → preview/dedupe → commit (encrypted like any manual transaction). 100% local; Papaparse is only ever fed a local File/string, never a URL (CLAUDE.md guardrail).

1. **Encoding**: read as ArrayBuffer; try `TextDecoder('utf-8', {fatal: true})`, fall back to `windows-1252`; manual override in UI.
2. **Header detection**: banks put preamble above the table — scan for the first row that looks like a header (mostly non-numeric cells) followed by consistently-shaped rows; skip everything above.
3. **Column mapping**: auto-guess from header synonyms (date/transaction date/posting date; description/details/particulars; amount; debit/credit; balance→ignored), shown in **ColumnMapper** for the user to confirm/fix; save as a named per-bank preset for one-click reuse.
4. **Dates**: try ISO first, then the preset's format; DMY-vs-MDY ambiguity resolved by scanning the whole column (any value > 12 disambiguates), otherwise the user picks.
5. **Amounts**: strip currency symbols and thousand separators; support comma-decimal; negatives as `-`, parentheses, or DR/CR markers; separate debit/credit columns merged into one signed amount; result converted to integer minor units.
6. **Dedupe**: `importHash = SHA-256(accountId|date|amount|normalized description)`; preview flags rows whose hash already exists in `transactions`; user includes/excludes per row.
7. **Category**: imported rows land as "Uncategorized" (bulk re-categorize from the transactions list); no auto-categorization in v1.

Tested with fixture CSVs imitating several formats (ISO dates + single amount column; DMY + debit/credit columns; comma-decimal; windows-1252 encoded; preamble rows).

## 6. Phased milestones

Each phase is independently testable and ends with `npm test` green + a manual check. **Encryption is Phase 1** (not Phase 3) because CLAUDE.md requires amounts encrypted at rest — every later phase then writes encrypted data from day one, and no migration is ever needed.

- **Phase 1 — Scaffold + encryption/session layer.** Vite + React 19 + TS scaffold, vite-plugin-pwa, Dexie `meta` table, crypto module (PBKDF2 derive, AES-GCM envelope, keycheck), setup/unlock/lock screens, auto-lock timer. ✔ Unit tests: envelope round-trip, wrong passphrase rejected, tamper detection; manual: set passphrase → reload → unlock.
- **Phase 2 — Accounts + transactions core.** Accounts CRUD, transactions CRUD via `repo.ts` (encrypted fields), transfers (linked pair), computed balances, filterable transaction list. ✔ Balance math unit tests (incl. transfers excluded from spend); manual CRUD flows.
- **Phase 3 — Categories + budgets dashboard.** Categories CRUD with caps, dashboard with per-category spent/remaining bars for the selected month, income vs expense totals. ✔ Budget math tests (month boundaries, no-cap categories, over-budget).
- **Phase 4 — Charts.** Recharts CategoryPie + SpendLine with month selector, theme-aware colors, empty states. ✔ Render tests with seeded data.
- **Phase 5 — CSV import.** Full pipeline + presets + dedupe. ✔ Fixture-CSV tests: varied formats normalize to identical transactions; dedupe flags repeats.
- **Phase 6 — Recurring + polish.** Recurring rules CRUD; catch-up runner on unlock (generates all due instances since `nextRunDate`, idempotent, advances the rule); encrypted backup export/import; PWA install verification; optional GitHub Pages deploy (base `/buget-tracker/`). ✔ Recurrence math tests (catch-up after N days away, end dates, month-end edge cases).

Known limitation (no backend): recurring transactions are auto-logged by catch-up when the app is opened/unlocked, not at the exact scheduled moment — reliable background execution isn't available to a client-only PWA.
