/**
 * The ARPS staff/demo bypass, for showcasing the game at the stand without
 * spending a real player's attempt and without a demo score ever landing on
 * the leaderboard.
 *
 * IMPORTANT — this is a *labelling* boundary, not a security boundary. Nothing
 * in this file can be trusted once a real backend exists. A flag set by the
 * client (this one included) is one devtools call away from being spoofed by
 * anyone, which is exactly the property the whole replay-verification design
 * in packages/sim exists to route around for real scores. When play tokens and
 * score submission land (see artifacts/grill-me/PourLine-Grill-Me-4.md), the
 * server must authenticate its own demo credential independently — issuing a
 * token that is exempt from the per-email attempt count and whose resulting
 * run is written with a status that every leaderboard query excludes — rather
 * than ever trusting a `demo: true` submitted by the page. Until that exists,
 * the worst case of this file misbehaving is a free extra play on a game with
 * no persisted scores at all, which is the current state of the whole app.
 */

const QUERY_PARAM = 'staff';
const STORAGE_KEY = 'pourline:demo';

/** The code a staff member visits once to unlock demo mode on their device. */
function configuredCode(): string | null {
  const fromEnv = import.meta.env.VITE_STAFF_CODE;
  if (fromEnv) return fromEnv;

  // Dev convenience only — lets the flow be exercised before a real code is
  // issued. import.meta.env.DEV is false in a production build, so a deploy
  // with no VITE_STAFF_CODE configured has no working staff link at all,
  // rather than silently defaulting open.
  return import.meta.env.DEV ? 'dev-demo' : null;
}

/**
 * Reads `?staff=...` once at boot, applies it, then scrubs it from the URL bar
 * and history so the code doesn't sit around visible or gets accidentally
 * shared if the page is reloaded, screenshotted, or bookmarked.
 *
 * `?staff=off` clears demo mode, for handing a demo phone back to normal.
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

/** True once a staff device has unlocked demo mode. Persists across reloads. */
export function isDemoMode(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
