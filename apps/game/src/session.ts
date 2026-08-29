/**
 * The local cache of "who is playing on this device and what attempts do
 * they have left." This is a convenience cache only, never the source of
 * truth — every number here can be wrong (stale, cleared, tampered with) and
 * nothing bad happens, because submit-run enforces the real limit
 * server-side regardless of what this says. The one thing this file is
 * responsible for getting right is not *offering* a play the server would
 * reject, so a player isn't led to burn time on a run that was never going
 * to count.
 *
 * A visit to register.html always re-fetches the true state from the server
 * and overwrites whatever is cached here, so staleness self-heals the moment
 * someone goes back through registration.
 */
import type { IssuedToken } from './api.ts';

const KEY = 'pourline:session';

export interface Session {
  playerId: string;
  displayName: string;
  attemptsTotal: number;
  /** Unused tokens only. Emptying this array is what "no attempts left" means. */
  tokens: IssuedToken[];
}

export function saveSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tokens)) return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

/** The attempt a "Play" button should use next, or null if none remain. */
export function nextToken(): IssuedToken | null {
  const s = loadSession();
  if (!s || s.tokens.length === 0) return null;
  return [...s.tokens].sort((a, b) => a.attemptNo - b.attemptNo)[0] ?? null;
}

/** Called after a run has been submitted (successfully or not — either way it's spent). */
export function consumeToken(tokenString: string): void {
  const s = loadSession();
  if (!s) return;
  s.tokens = s.tokens.filter((t) => t.token !== tokenString);
  saveSession(s);
}

export function attemptsRemaining(): number {
  return loadSession()?.tokens.length ?? 0;
}
