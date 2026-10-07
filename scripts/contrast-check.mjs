/**
 * WCAG contrast audit of the design tokens.
 *
 * Reads globals.css rather than duplicating the palette, and evaluates the
 * `oklch()` values the browser actually uses — not the hex fallbacks, which
 * exist only for engines without oklch and which the accent themes do not have
 * at all. Out-of-gamut colours are clamped exactly as a browser clamps them, so
 * the numbers reflect what ships.
 *
 * Every accent is checked in both modes: the themes are one hue variable each,
 * so the matrix is what proves that parameterisation is safe.
 *
 *   node scripts/contrast-check.mjs
 *
 * Exits non-zero on a failure, so it can be wired into CI.
 */

import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/globals.css', 'utf8');

/* ------------------------------------------------------------- colour maths */

const srgbChannel = (v) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  // Clamping is what "out of gamut" means on screen; measure the clamped value.
  return Math.min(1, Math.max(0, c));
};

/** oklch → linear sRGB → gamma-encoded sRGB, as a [0..1] triple. */
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    srgbChannel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    srgbChannel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    srgbChannel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const linear = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* ------------------------------------------------------------------ parsing */

/** Last declaration wins, matching the cascade within one block. */
function declarationsIn(block) {
  const out = {};
  for (const [, name, value] of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[name] = value.trim();
  }
  return out;
}

function blockAfter(marker, endMarker) {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`missing block: ${marker}`);
  const end = css.indexOf(endMarker, start);
  return css.slice(start, end === -1 ? undefined : end);
}

/** Splits `light-dark(a, b)` into its two sides. Anything else is the same
 *  value in both themes. */
function sides(value) {
  const open = value.toLowerCase().indexOf('light-dark(');
  if (open === -1) return [value, value];

  let depth = 0;
  let close = -1;
  for (let i = open + 10; i < value.length; i++) {
    if (value[i] === '(') depth += 1;
    else if (value[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }

  const inner = value.slice(open + 11, close);
  let commaDepth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') commaDepth += 1;
    else if (inner[i] === ')') commaDepth -= 1;
    else if (inner[i] === ',' && commaDepth === 0) {
      return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
    }
  }
  throw new Error(`malformed light-dark(): ${value}`);
}

// One block now holds both themes; the tiers are pulled apart here instead.
const allTokens = declarationsIn(blockAfter(':root {', "\n:root[data-theme='light']"));
const lightTokens = {};
const darkTokens = {};
for (const [name, value] of Object.entries(allTokens)) {
  const [light, dark] = sides(value);
  lightTokens[name] = light;
  darkTokens[name] = dark;
}

/** The hue table: one entry per accent theme. */
const accents = {};
for (const [, name, body] of css.matchAll(/\[data-accent='([a-z]+)'\]\s*\{([^}]*)\}/g)) {
  accents[name] = declarationsIn(body);
}

/**
 * Resolves a token to RGB. Handles `#rrggbb`, `oklch(L% C H)` and the accent
 * form `oklch(L% var(--accent-c) var(--accent-h))`, including a `calc(var(…) *
 * k)` chroma.
 */
/** The contents of `oklch(…)`, found by matching parens — a regex cannot,
 *  because the arguments themselves contain `var()` and `calc()`. */
function oklchBody(value) {
  const open = value.toLowerCase().indexOf('oklch(');
  if (open === -1) return null;

  let depth = 0;
  for (let i = open + 5; i < value.length; i++) {
    if (value[i] === '(') depth += 1;
    else if (value[i] === ')') {
      depth -= 1;
      if (depth === 0) return value.slice(open + 6, i);
    }
  }
  return null;
}

/** Splits on whitespace that is not inside parens. */
function splitArgs(body) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

function resolve(value, vars) {
  const body = oklchBody(value);
  if (!body) {
    const hex = value.match(/#[0-9a-f]{6}/i);
    if (hex) return hexToRgb(hex[0]);
    throw new Error(`cannot resolve: ${value}`);
  }

  const [rawL, rawC, rawH] = splitArgs(body);

  const num = (expr) => {
    if (expr === undefined) throw new Error(`missing argument in: ${value}`);
    // Whitespace survives inside the parens — splitArgs only breaks at depth 0.
    const scaled = expr.match(/^calc\(\s*var\(--([a-z0-9-]+)\)\s*\*\s*([\d.]+)\s*\)$/i);
    if (scaled) return Number(vars[scaled[1]]) * Number(scaled[2]);
    const plain = expr.match(/^var\(--([a-z0-9-]+)\)$/i);
    if (plain) {
      const looked = vars[plain[1]];
      if (looked === undefined) throw new Error(`unknown variable --${plain[1]} in: ${value}`);
      return Number(looked);
    }
    const n = Number(expr.replace('%', ''));
    if (Number.isNaN(n)) throw new Error(`cannot evaluate "${expr}" in: ${value}`);
    return n;
  };

  return oklchToRgb(num(rawL) / 100, num(rawC), num(rawH));
}

/* -------------------------------------------------------------------- audit */

const SURFACES = ['paper', 'surface', 'surface-2', 'surface-sunk'];
const TEXT_ON_SURFACE = ['ink', 'ink-2', 'muted', 'flag', 'p1', 'p3', 'date-today', 'date-tomorrow', 'date-week', 'date-later'];

let failures = 0;

function check(label, fg, bg, need) {
  const value = contrast(fg, bg);
  const ok = value >= need;
  if (!ok) failures += 1;
  console.log(
    `${ok ? '  ok  ' : ' FAIL '} ${label.padEnd(40)} ${value.toFixed(2).padStart(6)}:1  need ${need}`,
  );
}

for (const [modeName, tokens] of [
  ['light', lightTokens],
  ['dark', darkTokens],
]) {
  console.log(`\n=== ${modeName} — neutrals and semantics ===`);
  const vars = { ...accents.red, ...tokens };

  for (const surface of SURFACES) {
    const bg = resolve(tokens[surface], vars);
    for (const text of TEXT_ON_SURFACE) {
      check(`${text} on ${surface}`, resolve(tokens[text], vars), bg, 4.5);
    }
  }
  check('p4 border on paper', resolve(tokens.p4, vars), resolve(tokens.paper, vars), 3);

  console.log(`\n=== ${modeName} — every accent theme ===`);
  for (const [accentName, hue] of Object.entries(accents)) {
    const v = { ...hue, ...tokens };
    const accent = resolve(tokens.accent, v);
    const onAccent = resolve(tokens['on-accent'], v);

    // The accent is a link, a focus ring and a filled control, so it owes 4.5:1
    // as text on every surface *and* against its own foreground.
    for (const surface of SURFACES) {
      check(`${accentName}: accent on ${surface}`, accent, resolve(tokens[surface], v), 4.5);
    }
    /* The rail is a second surface family with its own foregrounds, and it is
       derived from the accent hue — so it needs checking per accent, not once.
       A dark slab is the easiest place to let secondary text drift to
       decorative-grey, and the one place nobody notices until they try to read
       a project name. */
    const rail = resolve(tokens.rail, v);
    check(`${accentName}: rail-ink on rail`, resolve(tokens['rail-ink'], v), rail, 4.5);
    check(`${accentName}: rail-muted on rail`, resolve(tokens['rail-muted'], v), rail, 4.5);
    check(
      `${accentName}: rail-ink on rail-active`,
      resolve(tokens['rail-ink'], v),
      resolve(tokens['rail-active'], v),
      4.5,
    );
    check(`${accentName}: active accent on rail-active`, accent, resolve(tokens['rail-active'], v), 4.5);
    check(
      `${accentName}: rail-muted on rail-hover`,
      resolve(tokens['rail-muted'], v),
      resolve(tokens['rail-hover'], v),
      4.5,
    );

    check(`${accentName}: on-accent over accent`, onAccent, accent, 4.5);
    check(
      `${accentName}: accent on accent-soft`,
      accent,
      resolve(tokens['accent-soft'], v),
      4.5,
    );
  }
}

console.log(
  failures === 0
    ? `\nAll pairs clear their threshold, across ${Object.keys(accents).length} accents × 2 modes.`
    : `\n${failures} pair(s) below threshold.`,
);
process.exit(failures === 0 ? 0 : 1);
