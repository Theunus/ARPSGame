/**
 * Client-side form validation. This is UX only — immediate feedback so
 * someone doesn't wait on a round trip to learn their number was wrong.
 *
 * The real enforcement is the identical rule in
 * supabase/functions/_shared/crypto.ts's isValidSaPhone, which the register
 * Edge Function actually checks. A client-side check alone is one devtools
 * call away from meaningless — same reasoning as the attempt limit, see
 * artifacts/grill-me/PourLine-Grill-Me-4.md. If you change the rule, change
 * it in both places.
 */

/**
 * True only for something that actually looks like a South African phone
 * number: no letters or stray symbols anywhere, and — once common formatting
 * characters are stripped — either a 10-digit local number starting with 0,
 * or +27 followed by 9 digits. Empty is not valid here; the field being
 * optional is handled at the call site, not in this function.
 */
export function isValidSaPhone(raw: string): boolean {
  const trimmed = raw.trim();
  // An optional leading + (nowhere else), then only digits and common
  // formatting characters — space, hyphen, parens, dot. A letter or a `+`
  // anywhere but the front fails here, before digit-counting even starts.
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/[\s\-().]/g, '');
  // Local: 0 + 9 more digits. International: +27 + 9 more digits. The digit
  // right after that leading 0 (or after +27) is never itself 0 in the SA
  // numbering plan, so "0021234567" — right length, not a real prefix — is
  // correctly rejected, not just anything the wrong length.
  return /^0[1-9]\d{8}$/.test(digits) || /^\+27[1-9]\d{8}$/.test(digits);
}
