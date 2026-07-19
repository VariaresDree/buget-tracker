import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public client-side config. The publishable key is safe to ship — row-level
// security guards the data and the vault blob is E2E-encrypted before upload.
// Read at call-time (not module top) so tests/env stubbing take effect.
const url = () => import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = () => import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

/** True when sync env vars are present (otherwise the app is local-only). */
export function isSyncConfigured(): boolean {
  return Boolean(url() && anonKey());
}

export function getSupabase(): SupabaseClient {
  const u = url();
  const k = anonKey();
  if (!u || !k) throw new Error('Sync is not configured.');
  if (!client) {
    client = createClient(u, k, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
