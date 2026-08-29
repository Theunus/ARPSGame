/**
 * POST /register — creates a player and issues their three play tokens, or
 * (if the email has already registered) returns whichever of those three are
 * still unused. This single endpoint is deliberately both "sign up" and
 * "resume" — a player who reloads the registration page, or opens the link on
 * a second device, gets their real remaining-attempts state back rather than
 * a fresh set of three.
 *
 * Request body:
 *   {
 *     fullName: string,
 *     email: string,
 *     phone?: string,
 *     consentCompetition: boolean,  // required, must be true
 *     consentMarketing: boolean,
 *     isAdult: boolean,             // required, must be true
 *     consentVersion: string,       // which wording they saw — Grill-Me-5
 *   }
 *
 * Response body:
 *   {
 *     playerId: string,
 *     displayName: string,
 *     attemptsTotal: 3,
 *     attemptsRemaining: number,
 *     tokens: [{ token: string, attemptNo: number, seed: number }],
 *   }
 *
 * `tokens` contains only attempts that are still usable — unused and
 * unexpired. An empty array with attemptsRemaining: 0 is not an error; it is
 * the correct response for someone who has already played their three.
 */

import { ATTEMPTS_PER_PLAYER, TOKEN_TTL_HOURS, env } from '../_shared/env.ts';
import {
  displayNameFrom,
  encryptField,
  hmacBase64Url,
  importAesKey,
  importHmacKey,
  isValidSaPhone,
  normalizeEmail,
  normalizePhone,
  signPlayToken,
} from '../_shared/crypto.ts';
import { adminClient } from '../_shared/db.ts';
import { json, preflight } from '../_shared/http.ts';

const CONSENT_VERSION_FALLBACK = 'unversioned';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterBody {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  consentCompetition?: unknown;
  consentMarketing?: unknown;
  isAdult?: unknown;
  consentVersion?: unknown;
}

interface PlayerRow {
  id: string;
  display_name: string;
}

interface TokenRow {
  id: string;
  attempt_no: number;
  seed: number;
  used_at: string | null;
  expires_at: string;
}

function randomSeed(): number {
  // A 31-bit positive int — comfortably inside JS's safe-integer range and
  // whatever numeric type the client and simulate() expect for a seed.
  return crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff;
}

function freshExpiry(): string {
  return new Date(Date.now() + TOKEN_TTL_HOURS * 3600_000).toISOString();
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: RegisterBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const consentCompetition = body.consentCompetition === true;
  const consentMarketing = body.consentMarketing === true;
  const isAdult = body.isAdult === true;
  const consentVersion =
    typeof body.consentVersion === 'string' && body.consentVersion ? body.consentVersion : CONSENT_VERSION_FALLBACK;

  if (!fullName) return json({ error: 'fullName is required' }, 400);
  if (!EMAIL_RE.test(rawEmail)) return json({ error: 'a valid email is required' }, 400);
  if (!consentCompetition) return json({ error: 'competition consent is required to enter' }, 400);
  if (!isAdult) return json({ error: 'entrants must confirm they are 18 or older' }, 400);
  // Optional field, but not a free-for-all: reject rather than silently clean
  // up garbage. Client-side validation.ts gives the same feedback earlier,
  // but this is the check that actually matters — see isValidSaPhone's comment.
  if (rawPhone && !isValidSaPhone(rawPhone)) {
    return json({ error: 'enter a valid South African phone number, e.g. 082 123 4567' }, 400);
  }

  const supabase = adminClient();
  const hashKey = await importHmacKey(env.emailHashSecret());
  const encKey = await importAesKey(env.emailEncKey());
  const tokenKey = await importHmacKey(env.tokenSecret());

  const emailHmac = await hmacBase64Url(hashKey, normalizeEmail(rawEmail));

  // --- find or create the player -------------------------------------------

  let player: PlayerRow | null = null;
  {
    const { data, error } = await supabase
      .from('players')
      .select('id, display_name')
      .eq('email_hmac', emailHmac)
      .maybeSingle();
    if (error) return json({ error: 'lookup failed' }, 500);
    player = data as PlayerRow | null;
  }

  if (!player) {
    const emailEnc = await encryptField(encKey, normalizeEmail(rawEmail));
    const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : null;
    const phoneHmac = normalizedPhone ? await hmacBase64Url(hashKey, normalizedPhone) : null;
    const phoneEnc = normalizedPhone ? await encryptField(encKey, normalizedPhone) : null;

    const { data, error } = await supabase
      .from('players')
      .insert({
        email_hmac: emailHmac,
        email_ciphertext: emailEnc.ciphertext,
        email_iv: emailEnc.iv,
        full_name: fullName,
        display_name: displayNameFrom(fullName),
        phone_hmac: phoneHmac,
        phone_ciphertext: phoneEnc?.ciphertext ?? null,
        phone_iv: phoneEnc?.iv ?? null,
        consent_competition: true,
        consent_marketing: consentMarketing,
        consent_version: consentVersion,
        is_adult: true,
      })
      .select('id, display_name')
      .single();

    if (error) {
      // Unique-violation race: someone else's request won between our lookup
      // and our insert (a double-tap on bad venue wifi is exactly the
      // scenario this project designs around — see Grill-Me-6). Re-fetch
      // rather than fail the request.
      if (error.code === '23505') {
        const retry = await supabase
          .from('players')
          .select('id, display_name')
          .eq('email_hmac', emailHmac)
          .single();
        if (retry.error) return json({ error: 'registration failed' }, 500);
        player = retry.data as PlayerRow;
      } else {
        return json({ error: 'registration failed' }, 500);
      }
    } else {
      player = data as PlayerRow;
    }
  }

  // --- find or create the three tokens -------------------------------------

  let tokenRows: TokenRow[];
  {
    const { data, error } = await supabase
      .from('play_tokens')
      .select('id, attempt_no, seed, used_at, expires_at')
      .eq('player_id', player.id)
      .order('attempt_no');
    if (error) return json({ error: 'lookup failed' }, 500);
    tokenRows = (data ?? []) as TokenRow[];
  }

  if (tokenRows.length === 0) {
    const inserts = Array.from({ length: ATTEMPTS_PER_PLAYER }, (_, i) => ({
      player_id: player!.id,
      attempt_no: i + 1,
      seed: randomSeed(),
      expires_at: freshExpiry(),
    }));

    const { data, error } = await supabase
      .from('play_tokens')
      .insert(inserts)
      .select('id, attempt_no, seed, used_at, expires_at');

    if (error) {
      if (error.code === '23505') {
        const retry = await supabase
          .from('play_tokens')
          .select('id, attempt_no, seed, used_at, expires_at')
          .eq('player_id', player.id)
          .order('attempt_no');
        if (retry.error) return json({ error: 'token issuance failed' }, 500);
        tokenRows = (retry.data ?? []) as TokenRow[];
      } else {
        return json({ error: 'token issuance failed' }, 500);
      }
    } else {
      tokenRows = (data ?? []) as TokenRow[];
    }
  }

  // Unused tokens past their expiry are refreshed rather than left dead —
  // the TTL is a safety net against a stale token being replayed long after
  // the fact, not a trap that should cost someone a real attempt because
  // venue wifi made them late. Extending expires_at doesn't touch anything
  // the signature covers, so the token string a player already has stays valid.
  const now = Date.now();
  const usable: TokenRow[] = [];
  for (const t of tokenRows) {
    if (t.used_at) continue;
    if (new Date(t.expires_at).getTime() < now) {
      const { data, error } = await supabase
        .from('play_tokens')
        .update({ expires_at: freshExpiry() })
        .eq('id', t.id)
        .select('id, attempt_no, seed, used_at, expires_at')
        .single();
      if (!error && data) usable.push(data as TokenRow);
    } else {
      usable.push(t);
    }
  }

  const tokens = await Promise.all(
    usable.map(async (t) => ({
      token: await signPlayToken(t.id, tokenKey),
      attemptNo: t.attempt_no,
      seed: t.seed,
    })),
  );

  return json({
    playerId: player.id,
    displayName: player.display_name,
    attemptsTotal: ATTEMPTS_PER_PLAYER,
    attemptsRemaining: tokens.length,
    tokens,
  });
});
