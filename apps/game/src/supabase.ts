/**
 * Supabase connection config. Production sets VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY at build time; the fallbacks are the local Docker
 * stack's fixed dev values, which are public and safe to commit.
 */

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const BASE_URL = import.meta.env.VITE_SUPABASE_URL ?? LOCAL_URL;

export const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY;
export const FUNCTIONS_URL = `${BASE_URL}/functions/v1`;
export const REST_URL = `${BASE_URL}/rest/v1`;
