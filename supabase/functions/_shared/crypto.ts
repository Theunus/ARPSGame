/**
 * Crypto and normalisation helpers, using Deno's native Web Crypto only.
 *
 * Three separate secrets, one job each, so compromising one doesn't expose the
 * others: EMAIL_HASH_SECRET (dedupe HMAC), EMAIL_ENC_KEY (AES-GCM field
 * encryption), TOKEN_SECRET (play-token signing).
 */

const te = new TextEncoder();

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

export function importHmacKey(base64Secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(base64Secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export function importAesKey(base64Secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBytes(base64Secret), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function hmacBase64Url(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

/** Constant-time HMAC verification via SubtleCrypto. */
export async function hmacVerify(key: CryptoKey, data: string, sigBase64Url: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify('HMAC', key, base64UrlToBytes(sigBase64Url), te.encode(data));
  } catch {
    return false;
  }
}

export interface EncryptedField {
  ciphertext: string;
  iv: string;
}

export async function encryptField(key: CryptoKey, plaintext: string): Promise<EncryptedField> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(plaintext));
  return { ciphertext: bytesToBase64(new Uint8Array(ct)), iv: bytesToBase64(iv) };
}

/** Signs a play-token capability string: "<tokenId>.<hmac(tokenId)>". */
export async function signPlayToken(tokenId: string, key: CryptoKey): Promise<string> {
  return `${tokenId}.${await hmacBase64Url(key, tokenId)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the tokenId if the signature and UUID shape check out, else null. */
export async function verifyPlayToken(token: string, key: CryptoKey): Promise<string | null> {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const tokenId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!UUID_RE.test(tokenId)) return null;
  return (await hmacVerify(key, tokenId, sig)) ? tokenId : null;
}

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

/** Normalises a valid SA number to E.164. Assumes SA for a bare leading 0. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return '+27' + digits.slice(1);
  return '+' + digits;
}

/** True only for a syntactically valid South African phone number. */
export function isValidSaPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/[\s\-().]/g, '');
  return /^0[1-9]\d{8}$/.test(digits) || /^\+27[1-9]\d{8}$/.test(digits);
}

/** "First L." — the only name-shaped value ever exposed publicly. */
export function displayNameFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Player';
  const first = parts[0] as string;
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1] as string;
  return `${first} ${last[0]?.toUpperCase()}.`;
}
