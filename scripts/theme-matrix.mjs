/**
 * Renders the app in every combination of OS preference and explicit choice,
 * and reports the colours the browser actually computed.
 *
 * The contrast checker reads the stylesheet; this reads the result. After a
 * change to how themes resolve — `light-dark()`, `color-scheme`, the bootstrap
 * script — only this can tell you the page agrees with the CSS.
 *
 *   node scripts/theme-matrix.mjs
 */

import { chromium } from '@playwright/test';
import { appBase } from './base-path.mjs';

const BASE = appBase(process.env.SHOT_BASE ?? 'http://localhost:3000');

/**
 * Read *used* properties, not the custom properties themselves.
 *
 * `getPropertyValue('--paper')` hands back the literal `light-dark(a, b)` text:
 * custom properties are substituted at use time, so the function is only
 * evaluated where the token is consumed. Reading `background-color` is what
 * shows which side won.
 */
const PROBE = () => {
  const body = getComputedStyle(document.body);
  const submit = document.querySelector('button[type="submit"]');
  return {
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    paper: body.backgroundColor,
    ink: body.color,
    accent: submit ? getComputedStyle(submit).backgroundColor : 'n/a',
  };
};

const CASES = [
  { name: 'OS light, no choice', os: 'light', choice: null, expect: 'light' },
  { name: 'OS dark,  no choice', os: 'dark', choice: null, expect: 'dark' },
  { name: 'OS light, forced dark', os: 'light', choice: 'dark', expect: 'dark' },
  { name: 'OS dark,  forced light', os: 'dark', choice: 'light', expect: 'light' },
];

const browser = await chromium.launch();
const results = {};

for (const testCase of CASES) {
  const context = await browser.newContext({ colorScheme: testCase.os });
  const page = await context.newPage();

  if (testCase.choice) {
    await page.addInitScript(
      (value) => localStorage.setItem('seder-theme', value),
      testCase.choice,
    );
  }

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });

  results[testCase.name] = await page.evaluate(PROBE);

  results[testCase.name].expect = testCase.expect;
  await context.close();
}

await browser.close();

/**
 * Light and dark are told apart by the ground. Chrome serialises an oklch
 * colour back as `oklch(L C H)` with L on 0–1 — not a percentage, and not rgb —
 * so both forms are handled rather than assumed.
 */
function themeOf(colour) {
  const nums = colour.match(/[\d.]+/g)?.map(Number) ?? [];
  if (colour.startsWith('oklch')) return nums[0] > 0.5 ? 'light' : 'dark';
  const [r = 0, g = 0, b = 0] = nums;
  return (r + g + b) / 3 > 128 ? 'light' : 'dark';
}

let failures = 0;
for (const [name, row] of Object.entries(results)) {
  const actual = themeOf(row.paper);
  const ok = actual === row.expect;
  if (!ok) failures += 1;
  console.log(
    `${ok ? '  ok  ' : ' FAIL '} ${name.padEnd(24)} → ${actual.padEnd(5)} ` +
      `color-scheme: ${row.colorScheme.padEnd(11)} paper ${row.paper}`,
  );
}

// The accent must differ between the themes, or light-dark() silently collapsed.
const lightAccent = results['OS light, no choice'].accent;
const darkAccent = results['OS dark,  no choice'].accent;
if (lightAccent === darkAccent) {
  console.log(` FAIL  accent is identical in both themes: ${lightAccent}`);
  failures += 1;
} else {
  console.log(`  ok   accent differs — light ${lightAccent} / dark ${darkAccent}`);
}

console.log(failures === 0 ? '\nEvery combination resolves as intended.' : `\n${failures} wrong.`);
process.exit(failures === 0 ? 0 : 1);
