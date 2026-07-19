// VaultGateway implemented over Supabase Postgres. Optimistic concurrency: an
// update is guarded by the base version, and an insert is used for the first
// push; either failing to affect a row signals a conflict.

import { getSupabase } from './client';
import type { RemoteVault, VaultGateway } from './vaultSync';

interface VaultRow {
  ciphertext: string;
  kdf: RemoteVault['kdf'];
  version: number;
}

export function supabaseGateway(): VaultGateway {
  const sb = getSupabase();

  return {
    async fetch(): Promise<RemoteVault | null> {
      const { data, error } = await sb
        .from('vaults')
        .select('ciphertext, kdf, version')
        .maybeSingle<VaultRow>();
      if (error) throw error;
      return data ? { ciphertext: data.ciphertext, kdf: data.kdf, version: data.version } : null;
    },

    async push(row) {
      const { data: userData } = await sb.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      if (row.version === 1) {
        const { error } = await sb.from('vaults').insert({
          user_id: userId,
          ciphertext: row.ciphertext,
          kdf: row.kdf,
          version: 1,
          device_id: row.deviceId,
        });
        return { ok: !error };
      }

      const { data, error } = await sb
        .from('vaults')
        .update({
          ciphertext: row.ciphertext,
          kdf: row.kdf,
          version: row.version,
          device_id: row.deviceId,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('version', row.version - 1)
        .select('version');
      if (error) return { ok: false };
      return { ok: (data?.length ?? 0) > 0 };
    },
  };
}
