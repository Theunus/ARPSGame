/**
 * Central place to read and validate the secrets these functions need.
 * Fails loudly and immediately if one is missing, rather than letting a
 * function limp along and fail confusingly on the first request that needs it.
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
 * the Edge Runtime (local and cloud both) — nothing to configure for those.
 * The three below are project-specific and must be set with
 * `supabase secrets set` (cloud) or in supabase/functions/.env (local, and
 * gitignored — see supabase/functions/.env.example).
 */

function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing required env var: ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => required('SUPABASE_URL'),
  serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  emailHashSecret: () => required('EMAIL_HASH_SECRET'),
  emailEncKey: () => required('EMAIL_ENC_KEY'),
  tokenSecret: () => required('TOKEN_SECRET'),
};

/** Three attempts per player. See artifacts/grill-me/PourLine-Grill-Me-4.md. */
export const ATTEMPTS_PER_PLAYER = 3;

/**
 * How long a play token stays valid after issuance. Generous on purpose: the
 * design assumes bad venue wifi (Grill-Me-6), so a player might register,
 * lose signal, and only submit a run an hour later. A hard competition
 * open/close window is a separate, not-yet-built control (branch 6); this is
 * just "don't let a token from last week's test run be replayed today."
 */
export const TOKEN_TTL_HOURS = 12;
