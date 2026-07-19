import { getSupabase } from './client';

// Thin wrappers over Supabase email/password auth. This identity only says
// *whose* encrypted blob it is — the account password is unrelated to the vault
// passphrase, which never leaves the device.

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw error;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

/** Current signed-in email, or null. */
export async function currentEmail(): Promise<string | null> {
  if (!getSupabase) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.email ?? null;
}
