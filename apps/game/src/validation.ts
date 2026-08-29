/**
 * Client-side form validation for immediate feedback. The real enforcement is
 * the identical isValidSaPhone in supabase/functions/_shared/crypto.ts, which
 * the register function checks; keep the two in sync.
 */

/** True only for a syntactically valid South African phone number. */
export function isValidSaPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/[\s\-().]/g, '');
  return /^0[1-9]\d{8}$/.test(digits) || /^\+27[1-9]\d{8}$/.test(digits);
}
