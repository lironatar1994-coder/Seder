/**
 * Mechanical mobile checks, in a real touch context.
 *
 * Two failures that a screenshot hides and a person stops noticing:
 *
 *  - **Horizontal overflow.** One element a few pixels too wide makes the whole
 *    page slide sideways under the thumb. It is invisible in a screenshot,
 *    which crops to the viewport.
 *  - **Undersized touch targets.** 24px looks fine and misses constantly. The
 *    floor is 44×44, and the target is the *hit* area, so this measures the
 *    `::before` many controls here use to grow past their box.
 *
 * The context sets `hasTouch`, without which the page reports `hover: hover`
 * and every touch-only rule keeps its desktop branch.
 *
 *   node scripts/mobile-audit.mjs
 */

import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { appBase } from './base-path.mjs';

const BASE = appBase(process.env.SHOT_BASE ?? 'http://localhost:3100');
const db = new PrismaClient();

/** Apple's floor, and the one Android's 48dp rounds to on most devices. */
const MIN_TARGET = 44;

/** A few pixels of slack: sub-pixel layout rounds badly at 2x. */
const SLACK = 1;

const WIDTHS = [320, 390, 430];

/**
 * A route, and optionally something to open on it first.
 *
 * A surface that only exists after a tap is exactly where an undersized target
 * hides: the quick-add sheet is the densest control strip in the app and a
 * plain page load never renders it.
 */
const PATHS = [
  { path: '/app/today' },
  { path: '/app/upcoming' },
  { path: '/app/inbox' },
  { path: '/app/calendar' },
  { path: '/app/settings/profile' },
  { path: '/app/settings/whatsapp' },
  {
    path: '/app/today',
    label: '/app/today · composer',
    open: (page) => page.getByRole('button', { name: 'חדשה' }).click(),
  },
];

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
let failures = 0;

/** Runs in the page: measures overflow and every interactive hit area. */
const AUDIT = (minTarget) => {
  const doc = document.documentElement;

  // The app shell scrolls its own column, so check both it and the document.
  const scrollers = [doc, ...document.querySelectorAll('main, [data-app-shell]')];
  const overflow = scrollers
    .map((el) => ({
      tag: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : ''),
      by: el.scrollWidth - el.clientWidth,
    }))
    .filter((r) => r.by > 1);

  // What actually sticks out, so the report names a culprit rather than a symptom.
  // A closed drawer legitimately sits off-screen. What makes that acceptable is
  // that it is also hidden from the tab order and the accessibility tree, and
  // `visibility` (which inherits, so one check covers the subtree) or `inert`
  // is how a page says exactly that. Anything off-screen *without* one of them
  // is the bug this is looking for.
  const hidden = (el) =>
    getComputedStyle(el).visibility === 'hidden' || el.closest('[inert]') !== null;

  // Content inside a horizontally scrolling strip is *meant* to run past the
  // edge — that is what makes it a strip. The scroller itself is still checked,
  // so a strip that is genuinely too wide for the screen is still caught; only
  // its children get the pass.
  const inScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const overflow = getComputedStyle(p).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    return false;
  };

  const wide = [];
  const limit = doc.clientWidth;
  for (const el of document.querySelectorAll('body *')) {
    if (hidden(el) || inScroller(el)) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    if (box.right > limit + 1 || box.left < -1) {
      // Only the outermost offender; its children inherit the problem.
      if (!wide.some((w) => w.node.contains(el))) {
        wide.push({ node: el, label: describe(el), right: Math.round(box.right), left: Math.round(box.left) });
      }
    }
  }

  const small = [];
  const selector = 'a[href], button, [role="button"], [role="checkbox"], input, select, textarea';
  for (const el of document.querySelectorAll(selector)) {
    if (hidden(el)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    // Fold in the ::before many controls use purely to widen the hit area.
    const before = getComputedStyle(el, '::before');
    let { width, height } = box;
    if (before.content && before.content !== 'none' && before.position === 'absolute') {
      const grow = (side) => {
        const value = parseFloat(before[side]);
        return Number.isFinite(value) && value < 0 ? -value : 0;
      };
      width += grow('left') + grow('right');
      height += grow('top') + grow('bottom');
    }

    if (width < minTarget || height < minTarget) {
      small.push({
        label: describe(el),
        size: `${Math.round(width)}×${Math.round(height)}`,
      });
    }
  }

  function describe(el) {
    const name =
      el.getAttribute('aria-label') ||
      el.textContent?.trim().slice(0, 24) ||
      el.getAttribute('placeholder') ||
      '';
    return `${el.tagName.toLowerCase()}${name ? ` "${name}"` : ''}`;
  }

  return { overflow, wide: wide.map((w) => ({ label: w.label, right: w.right, left: w.left })), small };
};

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    { name: 'seder_session', value: token, domain: 'localhost', path: '/', httpOnly: true },
  ]);
  const page = await context.newPage();

  for (const { path, label = path, open } of PATHS) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    if (open) {
      await open(page);
      await page.waitForTimeout(400);
    }
    const result = await page.evaluate(AUDIT, MIN_TARGET);

    const problems = [];
    for (const row of result.overflow) problems.push(`scrolls sideways: ${row.tag} by ${row.by}px`);
    for (const row of result.wide) problems.push(`outside the viewport: ${row.label} (${row.left}…${row.right})`);
    for (const row of result.small) problems.push(`target ${row.size}: ${row.label}`);

    if (problems.length) {
      failures += problems.length;
      console.log(` FAIL  ${width}px ${label}`);
      for (const problem of problems.slice(0, 12)) console.log(`         ${problem}`);
      if (problems.length > 12) console.log(`         …and ${problems.length - 12} more`);
    } else {
      console.log(`  ok   ${width}px ${label}`);
    }
  }

  await context.close();
}

await browser.close();
await db.session.deleteMany({
  where: { tokenHash: createHash('sha256').update(token).digest('hex') },
});
await db.$disconnect();

console.log(
  failures === 0
    ? `\nNo overflow, and every target clears ${MIN_TARGET}px.`
    : `\n${failures} problem(s).`,
);
process.exit(failures === 0 ? 0 : 1);
