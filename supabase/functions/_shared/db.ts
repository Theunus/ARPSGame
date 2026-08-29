import { createClient } from 'npm:@supabase/supabase-js@2';
import { env } from './env.ts';

/** Service-role client (bypasses RLS). Only for use inside the Edge Functions. */
export function adminClient() {
  return createClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false },
  });
}
