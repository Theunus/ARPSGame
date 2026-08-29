/** Reads and validates the secrets the functions need, failing fast if any is missing. */

function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing required env var: ${name}`);
  return v;
}

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the Edge Runtime.
// The other three are set via `supabase secrets set` (or supabase/functions/.env locally).
export const env = {
  supabaseUrl: () => required('SUPABASE_URL'),
  serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  emailHashSecret: () => required('EMAIL_HASH_SECRET'),
  emailEncKey: () => required('EMAIL_ENC_KEY'),
  tokenSecret: () => required('TOKEN_SECRET'),
};

export const ATTEMPTS_PER_PLAYER = 3;

/** How long a play token stays valid, generous enough to span a multi-day event. */
export const TOKEN_TTL_HOURS = 30 * 24;
