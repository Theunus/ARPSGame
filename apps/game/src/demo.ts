/**
 * Staff/demo bypass for showcasing the game without spending a real attempt.
 * A labelling convenience, not a security boundary: a demo run never fetches a
 * play token and never calls submit-run, so it can't touch the leaderboard.
 */

const QUERY_PARAM = 'staff';
const STORAGE_KEY = 'pourline:demo';

/** The staff code that unlocks demo mode, or null if none is configured. */
function configuredCode(): string | null {
  const fromEnv = import.meta.env.VITE_STAFF_CODE;
  if (fromEnv) return fromEnv;
  // Dev-only fallback; import.meta.env.DEV is false in production builds.
  return import.meta.env.DEV ? 'dev-demo' : null;
}

/**
 * Applies `?staff=<code>` (or `?staff=off`) from the URL, then scrubs the
 * parameter from the address bar so the code isn't left visible.
 */
export function consumeStaffCodeFromUrl(): void {
  const url = new URL(window.location.href);
  const code = url.searchParams.get(QUERY_PARAM);
  if (code === null) return;

  if (code === 'off') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    const expected = configuredCode();
    if (expected && code === expected) {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
  }

  url.searchParams.delete(QUERY_PARAM);
  window.history.replaceState({}, '', url.toString());
}

/** True once a staff device has unlocked demo mode. */
export function isDemoMode(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
