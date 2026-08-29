import type { InputEvent } from '@pourline/sim';
import { ANON_KEY, FUNCTIONS_URL } from './supabase.ts';

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
  isAdult: boolean;
  consentVersion: string;
}

export interface RegisterResponse {
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

/** A failed API call. status 0 means the request never reached the server. */
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
