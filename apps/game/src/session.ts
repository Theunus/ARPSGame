/**
 * Local cache of the player's attempts on this device. A convenience only —
 * submit-run enforces the real limit server-side, so a stale or tampered cache
 * can never do worse than offer a play the server will reject.
 */
import type { IssuedToken } from './api.ts';

const KEY = 'pourline:session';

export interface Session {
  displayName: string;
  attemptsTotal: number;
  /** Unused tokens only. Empty means no attempts left. */
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

/** The next unused attempt, or null if none remain. */
export function nextToken(): IssuedToken | null {
  const s = loadSession();
  if (!s || s.tokens.length === 0) return null;
  return [...s.tokens].sort((a, b) => a.attemptNo - b.attemptNo)[0] ?? null;
}

/** Drops a token from the cache after its run has been submitted. */
export function consumeToken(tokenString: string): void {
  const s = loadSession();
  if (!s) return;
  s.tokens = s.tokens.filter((t) => t.token !== tokenString);
  saveSession(s);
}
