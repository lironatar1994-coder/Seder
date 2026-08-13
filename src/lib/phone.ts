/**
 * Israeli mobile numbers, in the shapes people actually type them.
 *
 * One canonical stored form — local, no separators, `0541234567` — because the
 * number is a unique key on the account. If `054-123-4567` and `+972541234567`
 * were allowed to sit in the column as written, the same phone could register
 * twice and an inbound message would have no single owner.
 */

/** 05X + 7 digits. Landlines are excluded deliberately: this number is how the
 *  app both recognises you and sends to you, and a landline does neither. */
const MOBILE = /^05\d{8}$/;

/**
 * The stored form, or null if it is not an Israeli mobile.
 *
 * Accepts separators, a leading `+972`, `972`, or `00972`.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return null;

  // "00" is the older way to write the "+".
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Israeli numbers drop the trunk zero once the country code is there, so
  // putting it back is what makes "+972 54…" and "054…" one value. No local
  // number starts with 972, so this cannot misfire.
  const local = digits.startsWith('972') ? `0${digits.slice(3)}` : digits;

  return MOBILE.test(local) ? local : null;
}

/** The form WhatsApp addresses: country code, no plus, no trunk zero. */
export function toInternational(localPhone: string): string {
  return `972${localPhone.slice(1)}`;
}

/** The stored form, from whatever WhatsApp handed us. */
export function fromInternational(internationalPhone: string): string | null {
  return normalizePhone(internationalPhone);
}

/** For display beside a Hebrew label: `054-123-4567`. */
export function formatPhone(localPhone: string): string {
  return `${localPhone.slice(0, 3)}-${localPhone.slice(3, 6)}-${localPhone.slice(6)}`;
}
