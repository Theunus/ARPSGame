/**
 * POST /submit-run — the anti-cheat gate. Re-simulates the player's input log
 * against the seed the server issued, using the same deterministic module the
 * client runs, and records only a score that reproduces exactly.
 */

import { simulate, validateInputLog } from '../../../packages/sim/src/simulate.ts';
import type { InputEvent } from '../../../packages/sim/src/types.ts';
import { importHmacKey, verifyPlayToken } from '../_shared/crypto.ts';
import { env } from '../_shared/env.ts';
import { adminClient } from '../_shared/db.ts';
import { json, preflight } from '../_shared/http.ts';

interface SubmitBody {
  token?: unknown;
  inputLog?: unknown;
  claimedScore?: unknown;
  durationFrames?: unknown;
  clientVersion?: unknown;
}

interface TokenRow {
  id: string;
  player_id: string;
  attempt_no: number;
  seed: number;
  used_at: string | null;
  expires_at: string;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const tokenString = typeof body.token === 'string' ? body.token : '';
  const claimedScore = typeof body.claimedScore === 'number' ? body.claimedScore : NaN;
  const durationFrames = typeof body.durationFrames === 'number' ? body.durationFrames : null;
  const clientVersion = typeof body.clientVersion === 'string' ? body.clientVersion.slice(0, 64) : null;
  const inputLog = Array.isArray(body.inputLog) ? (body.inputLog as InputEvent[]) : null;

  if (!tokenString) return json({ error: 'token is required' }, 400);
  if (!inputLog) return json({ error: 'inputLog must be an array' }, 400);
  if (!Number.isFinite(claimedScore)) return json({ error: 'claimedScore is required' }, 400);

  const structural = validateInputLog(inputLog);
  if (!structural.ok) return json({ error: `bad input log: ${structural.reason}` }, 400);

  const tokenKey = await importHmacKey(env.tokenSecret());
  const tokenId = await verifyPlayToken(tokenString, tokenKey);
  if (!tokenId) return json({ error: 'invalid or forged token' }, 401);

  const supabase = adminClient();

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('play_tokens')
    .select('id, player_id, attempt_no, seed, used_at, expires_at')
    .eq('id', tokenId)
    .maybeSingle();

  if (tokenErr) return json({ error: 'token lookup failed' }, 500);
  if (!tokenRow) return json({ error: 'unknown token' }, 401);

  const token = tokenRow as TokenRow;

  if (token.used_at) return json({ error: 'this attempt has already been submitted' }, 409);
  if (new Date(token.expires_at).getTime() < Date.now()) {
    return json({ error: 'this attempt has expired' }, 409);
  }

  // Claim the token first, guarded so only the first of two concurrent
  // submissions (a retried request) wins.
  const claim = await supabase
    .from('play_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id)
    .is('used_at', null)
    .select('id');

  if (claim.error) return json({ error: 'could not claim attempt' }, 500);
  if (!claim.data || claim.data.length === 0) {
    return json({ error: 'this attempt has already been submitted' }, 409);
  }

  const result = simulate(token.seed, inputLog);
  const ok = result.score === claimedScore;

  const { error: insertErr } = await supabase.from('runs').insert({
    player_id: token.player_id,
    token_id: token.id,
    attempt_no: token.attempt_no,
    seed: token.seed,
    input_log: inputLog,
    claimed_score: claimedScore,
    verified_score: ok ? result.score : null,
    max_combo: ok ? result.maxCombo : null,
    moulds_completed: ok ? result.mouldsCompleted : null,
    status: ok ? 'verified' : 'rejected',
    duration_frames: durationFrames,
    client_version: clientVersion,
    validated_at: new Date().toISOString(),
  });

  if (insertErr) return json({ error: 'could not record run' }, 500);

  const { count } = await supabase
    .from('play_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', token.player_id)
    .is('used_at', null);

  const attemptsRemaining = count ?? 0;

  if (!ok) {
    return json(
      {
        ok: false,
        reason: `submitted score did not match the replayed result (claimed ${claimedScore}, replayed ${result.score})`,
        attemptsRemaining,
      },
      200,
    );
  }

  return json({ ok: true, verifiedScore: result.score, attemptsRemaining });
});
