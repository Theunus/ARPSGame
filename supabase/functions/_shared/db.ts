import { createClient } from 'npm:@supabase/supabase-js@2';
import { env } from './env.ts';

/**
 * Service-role client — bypasses RLS entirely. This is deliberate and safe
 * *because* it only ever runs inside these two functions, which validate
 * everything themselves before touching the database; it must never be the
 * key handed to a browser. The browser gets the anon key, which (per the
 * migration) can reach exactly one thing: the public_leaderboard view.
 */
export function adminClient() {
  return createClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false },
  });
}
