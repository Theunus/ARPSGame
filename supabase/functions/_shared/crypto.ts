/**
 * Crypto and normalisation helpers shared by the register and submit-run
 * functions. Deno's native Web Crypto (`crypto.subtle`) — no npm dependency,
 * no key material ever leaves this process unencrypted.
 *
 * Key separation: three distinct secrets, each doing one job, so that
 * compromising one (say, the token secret, which is exercised on every
 * request) doesn't also expose the ability to decrypt stored emails.
 *   EMAIL_HASH_SECRET — HMAC key for the dedupe hash (email_hmac, phone_hmac)
 *   EMAIL_ENC_KEY      — AES-256-GCM key for the actual ciphertext columns
 *   TOKEN_SECRET        — HMAC key that signs play-token capability strings
 */

const te = new TextEncoder();
const td = new TextDecoder();

// ---------------------------------------------------------------------------
// base64 / base64url — Deno has no Buffer by default; btoa/atob operate on
// byte-valued strings, which is exactly what a Uint8Array round-trip gives us.
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const pad = b64url.length % 4 === 0 ? '' : '='.repeat(4 - (b64url.length % 4));
  return base64ToBytes(b64url.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export async function importHmacKey(base64Secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(base64Secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function importAesKey(base64Secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBytes(base64Secret), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// ---------------------------------------------------------------------------
// HMAC — dedupe hashing and token signing both go through this
// ---------------------------------------------------------------------------

export async function hmacBase64Url(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

/** Uses SubtleCrypto's verify, not a manual string compare — avoids a timing side-channel. */
export async function hmacVerify(key: CryptoKey, data: string, sigBase64Url: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify('HMAC', key, base64UrlToBytes(sigBase64Url), te.encode(data));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// AES-GCM field encryption
// ---------------------------------------------------------------------------

export interface EncryptedField {
  ciphertext: string;
  iv: string;
}

export async function encryptField(key: CryptoKey, plaintext: string): Promise<EncryptedField> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(plaintext));
  return { ciphertext: bytesToBase64(new Uint8Array(ct)), iv: bytesToBase64(iv) };
}

export async function decryptField(key: CryptoKey, field: EncryptedField): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(field.iv) },
    key,
    base64ToBytes(field.ciphertext),
  );
  return td.decode(pt);
}

// ---------------------------------------------------------------------------
// Play-token capability strings — "<tokenId>.<hmac(tokenId)>"
//
// The signature isn't the access-control boundary (RLS already makes the
// tokens table unreachable by the anon key) — it's defence in depth so that
// the token itself, not just "any UUID that happens to be in the database",
// is the credential. See artifacts/grill-me/PourLine-Grill-Me-4.md.
// ---------------------------------------------------------------------------

export async function signPlayToken(tokenId: string, key: CryptoKey): Promise<string> {
  return `${tokenId}.${await hmacBase64Url(key, tokenId)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the tokenId if the signature checks out and the shape is a real UUID, else null. */
export async function verifyPlayToken(token: string, key: CryptoKey): Promise<string | null> {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const tokenId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!UUID_RE.test(tokenId)) return null;
  return (await hmacVerify(key, tokenId, sig)) ? tokenId : null;
}

// ---------------------------------------------------------------------------
// Normalisation — must exactly match artifacts/grill-me/PourLine-Grill-Me-4.md
// ---------------------------------------------------------------------------

/** Lowercase, trimmed, +tag stripped, Gmail/Googlemail dots stripped. */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at === -1) return email;

  let local = email.slice(0, at);
  const domain = email.slice(at + 1);

  const plus = local.indexOf('+');
  if (plus !== -1) local = local.slice(0, plus);

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

/** Best-effort E.164-ish normalisation. Assumes SA numbers for a bare leading 0. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return '+27' + digits.slice(1);
  return '+' + digits;
}

/** "First L." — the only name-shaped thing ever exposed publicly. */
export function displayNameFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Player';
  const first = parts[0] as string;
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1] as string;
  return `${first} ${last[0]?.toUpperCase()}.`;
}
