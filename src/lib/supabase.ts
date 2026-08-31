import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * React's StrictMode (dev only) mounts each effect twice (mount → cleanup →
 * mount), which can re-run a channel-subscription effect with the same topic
 * before the first mount's `removeChannel()` cleanup has actually finished on
 * the socket. Supabase then throws "cannot add postgres_changes callbacks
 * ... after subscribe()" on the second mount. Proactively drop any stale
 * channel with the same topic before creating a new one to avoid this.
 */
export const createChannel = (topic: string) => {
  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (existing) {
    supabase.removeChannel(existing);
  }
  return supabase.channel(topic);
};

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({ provider: 'google' });

export const logout = () => supabase.auth.signOut();

export const signUpWithEmail = (email: string, password: string, displayName?: string) =>
  supabase.auth.signUp({
    email,
    password,
    options: displayName ? { data: { display_name: displayName } } : undefined,
  });

export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const isPasswordProviderUser = (
  session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
) =>
  session?.user.app_metadata?.provider === 'email' ||
  (session?.user.identities ?? []).some((identity) => identity.provider === 'email');

export const changePassword = (newPassword: string) =>
  supabase.auth.updateUser({ password: newPassword });

/**
 * Password recovery, in three steps — mirrors the signup OTP flow so the user
 * sees the same kind of screen twice instead of two different mechanisms:
 *   1. sendPasswordResetCode(email)   → Supabase emails a numeric code
 *      (the "Reset password" template must use {{ .Token }}, not a magic link)
 *   2. verifyPasswordResetCode(...)   → exchanges the code for a session
 *   3. changePassword(newPassword)    → writes the new password on that session
 */
export const sendPasswordResetCode = (email: string) =>
  supabase.auth.resetPasswordForEmail(email);

export const verifyPasswordResetCode = (email: string, token: string) =>
  supabase.auth.verifyOtp({ email, token, type: 'recovery' });
