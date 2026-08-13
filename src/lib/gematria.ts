/** Hebrew numerals.
 *
 *  ICU knows the Hebrew calendar but will not render its numbers in Hebrew —
 *  `nu-hebr` silently resolves back to Latin digits, so `Intl` hands back
 *  "29 באב" where a Hebrew reader expects "כ״ט באב". The conversion is small
 *  and fully specified, so it is done here.
 */

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

const GERESH = '׳';
const GERSHAYIM = '״';

/** Letters for `n`, with no punctuation. */
function letters(n: number): string {
  let out = '';
  let rest = n;

  // 400 is the largest single letter; 500–900 are written as ת repeated.
  while (rest >= 400) {
    out += HUNDREDS[4];
    rest -= 400;
  }
  if (rest >= 100) {
    out += HUNDREDS[Math.floor(rest / 100)];
    rest %= 100;
  }

  // 15 and 16 would spell parts of the divine name as י״ה and י״ו, so they are
  // written ט״ו and ט״ז instead. The rule applies to the final two digits,
  // which is why it is checked after the hundreds are taken off.
  if (rest === 15) return out + 'טו';
  if (rest === 16) return out + 'טז';

  out += TENS[Math.floor(rest / 10)];
  out += ONES[rest % 10];
  return out;
}

/**
 * Hebrew numeral with the conventional punctuation: a geresh after a single
 * letter (ה׳), gershayim before the last of several (כ״ט).
 */
export function toGematria(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n);

  const raw = letters(n);
  if (raw.length === 0) return String(n);
  if (raw.length === 1) return raw + GERESH;
  return raw.slice(0, -1) + GERSHAYIM + raw.slice(-1);
}

/**
 * Hebrew year in the common short form: the thousands digit, a geresh, then the
 * remainder — 5786 becomes ה׳תשפ״ו.
 */
export function toHebrewYear(year: number): string {
  const thousands = Math.floor(year / 1000);
  const rest = year % 1000;
  if (thousands === 0) return toGematria(rest);
  return `${letters(thousands)}${GERESH}${toGematria(rest).replace(GERESH, '')}`;
}
