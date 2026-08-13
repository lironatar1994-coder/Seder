/**
 * Spacing audit for the task editor.
 *
 * Two rules, both mechanical:
 *
 *  1. **On the scale.** Layout spacing — 12px and up — is a multiple of 4.
 *     That is where drift shows: 13px here, 18px there, each defensible alone
 *     and collectively the reason a screen looks unresolved.
 *
 *     Below 12px the rule is multiples of 2, because that range is not layout.
 *     It is the gap between an icon and its label inside a button, which is
 *     tied to the text it sits next to rather than to the page grid — 6px is
 *     right there and 8px is visibly loose. Enforcing multiples of 4 all the
 *     way down would not tighten the design, it would only force every icon
 *     gap to one of two wrong values.
 *
 *  2. **Internal < external.** The space inside a group must be smaller than
 *     the space around it, or the grouping stops being visible and the panel
 *     reads as one undifferentiated stack. This is the rule people mean when
 *     they say a design "breathes" — it is not about more space, it is about
 *     the ratio between two spaces.
 *
 *   node scripts/spacing-check.mjs
 */

import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { appBase } from './base-path.mjs';

const BASE = appBase(process.env.SHOT_BASE ?? 'http://localhost:3100');
const db = new PrismaClient();

const user = await db.user.findUnique({ where: { email: 'demo@seder.app' } });
if (!user) throw new Error('Seed first: npm run db:seed');

const token = randomBytes(32).toString('base64url');
await db.session.create({
  data: {
    tokenHash: createHash('sha256').update(token).digest('hex'),
    userId: user.id,
    expiresAt: new Date(Date.now() + 3600_000),
  },
});

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: 'he-IL',
  timezoneId: 'Asia/Jerusalem',
});
await context.addCookies([
  { name: 'seder_session', value: token, domain: 'localhost', path: '/', httpOnly: true },
]);

const page = await context.newPage();
await page.goto(`${BASE}/app/today`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => document.fonts.ready);
await page.getByRole('button', { name: /פתיחת לסיים את המצגת/ }).click();
await page.getByRole('dialog').waitFor();

const report = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  const px = (value) => Math.round(parseFloat(value) || 0);

  const problems = [];
  const measured = [];

  /** Every padding and row-gap inside the editor, with where it came from. */
  const offGrid = [];
  for (const el of dialog.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    for (const prop of ['paddingTop', 'paddingBottom', 'paddingInlineStart', 'paddingInlineEnd', 'rowGap', 'columnGap']) {
      const value = px(style[prop]);
      if (value === 0 || Number.isNaN(value)) continue;
      const step = value >= 12 ? 4 : 2;
      if (value % step !== 0) {
        offGrid.push(`${value}px ${prop} on ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
      }
    }
  }

  /* The rail: the gap between a label and its control against the gap between
     one field and the next. */
  const rail = dialog.querySelector('aside');
  const rows = rail ? [...rail.children] : [];
  let internal = null;
  let external = null;

  if (rows.length >= 2) {
    const first = rows[0];
    const label = first.querySelector('label, span');
    const control = first.children[1];
    if (label && control) {
      internal = Math.round(
        control.getBoundingClientRect().top - label.getBoundingClientRect().bottom,
      );
    }
    external = Math.round(
      rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().bottom,
    );
  }

  measured.push(`rail: ${internal}px inside a field, ${external}px between fields`);
  if (internal !== null && external !== null && internal >= external) {
    problems.push(
      `rail grouping is invisible: ${internal}px inside a field vs ${external}px between them`,
    );
  }

  for (const entry of offGrid) problems.push(`off the 4px scale: ${entry}`);

  /* The main column should not end in a large void.
     Measured from where the *content* actually stops, not from the box that
     holds it: a grid row set to `1fr` stretches to the tall rail beside it, so
     the container reports a comfortable 100% while the eye sees a third of a
     column of nothing. Find the lowest painted thing in the content column and
     compare that to the bottom of the dialog. */
  const main = dialog.querySelector('[class*="order-1"]');
  const subtasks = dialog.querySelector('[class*="order-3"]');
  if (main && subtasks) {
    let lowest = 0;
    for (const el of subtasks.querySelectorAll('*')) {
      const box = el.getBoundingClientRect();
      if (box.height > 0) lowest = Math.max(lowest, box.bottom);
    }
    const dialogBox = dialog.getBoundingClientRect();
    const trailing = Math.round(dialogBox.bottom - lowest);
    const share = Math.round((trailing / dialogBox.height) * 100);
    measured.push(`${trailing}px below the last content in the column (${share}% of the dialog)`);
    if (share > 20) {
      problems.push(`${share}% of the dialog is empty under the content column`);
    }
  }

  return { problems, measured };
});

for (const line of report.measured) console.log(`  ·   ${line}`);
for (const line of report.problems) console.log(` FAIL  ${line}`);

await browser.close();
await db.session.deleteMany({
  where: { tokenHash: createHash('sha256').update(token).digest('hex') },
});
await db.$disconnect();

console.log(
  report.problems.length === 0
    ? '\nEvery gap is on the scale, and every group is visible.'
    : `\n${report.problems.length} problem(s).`,
);
process.exit(report.problems.length === 0 ? 0 : 1);
