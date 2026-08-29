/**
 * Talks to the two Edge Functions in supabase/functions/. No supabase-js
 * dependency here — these are plain POSTs, which keeps the game bundle
 * small and means the exact same code path works whether the backend is the
 * local Docker stack or the real deployed project; only the URL/key differ.
 */
import type { InputEvent } from '@pourline/sim';

// Supabase's local dev stack always uses this fixed demo anon key — it is
// documented as public and is meaningless against any real project, so it is
// not a secret and is safe to commit as the local-dev default. Production
// reads the real project's anon key from the build environment.
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ?? 'http://127.0.0.1:54321/functions/v1';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY;

export interface IssuedToken {
  token: string;
  attemptNo: number;
  seed: number;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone?: string;
  consentCompetition: boolean;
  consentMarketing: boolean;
  isAdult: boolean;
  consentVersion: string;
}

export interface RegisterResponse {
  playerId: string;
  displayName: string;
  attemptsTotal: number;
  attemptsRemaining: number;
  tokens: IssuedToken[];
}

export interface SubmitRunRequest {
  token: string;
  inputLog: InputEvent[];
  claimedScore: number;
  durationFrames: number;
  clientVersion: string;
}

export interface SubmitRunResponse {
  ok: boolean;
  verifiedScore?: number;
  reason?: string;
  attemptsRemaining?: number;
  error?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network failure — the offline-tolerant queue this deserves (Grill-Me-6)
    // isn't built yet; for now this surfaces as a clear, retryable error
    // rather than an unhandled rejection.
    throw new ApiError(`network error contacting ${name}: ${(err as Error).message}`, 0);
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ApiError(data.error ?? `${name} failed with ${res.status}`, res.status);
  }
  return data;
}

export function register(req: RegisterRequest): Promise<RegisterResponse> {
  return callFunction<RegisterResponse>('register', req);
}

export function submitRun(req: SubmitRunRequest): Promise<SubmitRunResponse> {
  return callFunction<SubmitRunResponse>('submit-run', req);
}
