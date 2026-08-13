/**
 * Screenshot harness for design review.
 *
 * Signs in by minting a session row directly and setting the cookie, so no
 * credentials are typed anywhere. Point it at a running server:
 *
 *   npx next start -p 3100
 *   node scripts/shots.mjs
 */

import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { appBase } from './base-path.mjs';

const BASE = appBase(process.env.SHOT_BASE ?? 'http://localhost:3100');
const OUT = 'screenshots';
const db = new PrismaClient();

mkdirSync(OUT, { recursive: true });

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

async function shoot(name, { width, height, theme, path, action }) {
  // A narrow viewport is not a phone. Without `hasTouch` the context still
  // reports `hover: hover` and `pointer: fine`, so every touch-only rule — the
  // always-visible row menu, the enlarged hit areas — silently keeps its
  // desktop branch and the screenshot shows something no phone renders.
  const phone = width < 768;

  const context = await browser.newContext({
    viewport: { width, height },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    deviceScaleFactor: 2,
    hasTouch: phone,
    isMobile: phone,
  });
  await context.addCookies([
    { name: 'seder_session', value: token, domain: 'localhost', path: '/', httpOnly: true },
  ]);

  // Light is the default now, and the OS preference only applies to someone who
  // has chosen "system" — so `colorScheme` alone renders every "dark" shot
  // light. Store the choice the way the app stores it.
  const page = await context.newPage();
  if (theme === 'dark' || theme === 'light') {
    await page.addInitScript((value) => {
      try {
        localStorage.setItem('seder-theme', value);
      } catch {}
    }, theme);
  }
  // Not `networkidle`: it waits for 500ms of silence that a page holding any
  // long-lived connection never gives, and hangs the whole run on one route.
  // Fonts are the only thing worth waiting for here, and `document.fonts`
  // answers that directly.
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  if (action) await action(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✓ ${name}.png`);
  await context.close();
}

await shoot('01-today', { width: 1280, height: 860, path: '/app/today' });
await shoot('02-today-dark', {
  width: 1280,
  height: 860,
  theme: 'dark',
  path: '/app/today',
});
await shoot('03-upcoming', { width: 1280, height: 900, path: '/app/upcoming' });
await shoot('04-project', {
  width: 1280,
  height: 860,
  path: '/app/today',
  action: async (page) => {
    await page.getByRole('link', { name: /טיול ליוון/ }).click();
    await page.waitForURL('**/app/project/**');
  },
});
await shoot('05-composer', {
  width: 1280,
  height: 700,
  path: '/app/today',
  action: async (page) => {
    await page.getByRole('button', { name: 'משימה חדשה' }).click();
    await page
      .getByLabel('משימה חדשה')
      .fill('להזמין מקום לארוחה ביום חמישי בשעה 20:00 #טיול ליוון @טלפון !2');
  },
});
await shoot('06-detail', {
  width: 1280,
  height: 860,
  path: '/app/today',
  action: async (page) => {
    await page.getByRole('button', { name: /פתיחת לסיים את המצגת/ }).click();
    await page.waitForTimeout(300);
  },
});
await shoot('07-palette', {
  width: 1280,
  height: 700,
  path: '/app/today',
  action: async (page) => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
  },
});
await shoot('11-calendar-month', { width: 1400, height: 1000, path: '/app/calendar' });
await shoot('12-calendar-week', { width: 1400, height: 820, path: '/app/calendar?v=week' });
await shoot('13-calendar-dark', {
  width: 1400,
  height: 1000,
  theme: 'dark',
  path: '/app/calendar',
});
await shoot('14-calendar-day', {
  width: 1400,
  height: 1000,
  path: '/app/calendar',
  action: async (page) => {
    await page.locator('[data-day]').filter({ hasText: 'לסיים' }).first().click();
    await page.waitForTimeout(300);
  },
});
await shoot('15-calendar-mobile', { width: 390, height: 844, path: '/app/calendar' });
await shoot('16-date-picker', {
  width: 1280,
  height: 860,
  path: '/app/today',
  action: async (page) => {
    await page.getByRole('button', { name: /פתיחת לסיים את המצגת/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'היום', exact: true }).click();
    await page.waitForTimeout(350);
  },
});

await shoot('17-inbox', { width: 1280, height: 800, path: '/app/inbox' });
await shoot('18-search', {
  width: 1280,
  height: 760,
  path: '/app/today',
  action: async (page) => {
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder(/חיפוש משימה/).fill('לחדש');
    await page.waitForTimeout(600);
  },
});

await shoot('19-repeat', {
  width: 1280,
  height: 800,
  path: '/app/today',
  action: async (page) => {
    await page.getByRole('button', { name: /פתיחת ישיבת צוות שבועית/ }).click();
    await page.waitForTimeout(300);
  },
});
await shoot('20-move', {
  width: 1280,
  height: 800,
  path: '/app/inbox',
  action: async (page) => {
    await page.getByRole('button', { name: 'אפשרויות למשימה' }).first().click();
    await page.getByRole('menuitem', { name: 'העברה לפרויקט' }).click();
    await page.waitForTimeout(400);
  },
});

await shoot('21-logbook', { width: 1280, height: 800, path: '/app/logbook' });
await shoot('22-forgot', { width: 1280, height: 700, path: '/forgot' });

await shoot('23-settings-profile', { width: 1280, height: 800, path: '/app/settings/profile' });
await shoot('24-settings-appearance', { width: 1280, height: 800, path: '/app/settings/appearance' });
await shoot('25-settings-account', { width: 1280, height: 800, path: '/app/settings/account' });
await shoot('26-settings-dark', { width: 1280, height: 800, theme: 'dark', path: '/app/settings/password' });

await shoot('27-accents', { width: 1280, height: 700, path: '/app/settings/appearance' });
await shoot('28-accent-green', {
  width: 1280,
  height: 760,
  path: '/app/settings/appearance',
  action: async (page) => {
    await page.getByRole('radio', { name: 'ירוק' }).click();
    await page.goto(BASE + '/app/today');
    await page.waitForTimeout(400);
  },
});
await shoot('29-accent-pink-dark', {
  width: 1280,
  height: 760,
  theme: 'dark',
  path: '/app/settings/appearance',
  action: async (page) => {
    await page.getByRole('radio', { name: 'ורוד' }).click();
    await page.goto(BASE + '/app/today');
    await page.waitForTimeout(400);
  },
});

/** Two rows selected, so the bulk bar is on screen with something to act on. */
const selectTwo = async (page) => {
  const rows = page.getByRole('button', { name: /^פתיחת / });
  await rows.nth(0).click({ modifiers: ['Control'] });
  await rows.nth(1).click({ modifiers: ['Control'] });
  await page.waitForTimeout(300);
};

await shoot('30-bulk-bar', {
  width: 1280,
  height: 860,
  path: '/app/today',
  action: selectTwo,
});
await shoot('31-bulk-bar-dark', {
  width: 1280,
  height: 860,
  theme: 'dark',
  path: '/app/today',
  action: selectTwo,
});
await shoot('32-bulk-bar-mobile', {
  width: 390,
  height: 844,
  path: '/app/today',
  action: selectTwo,
});

await shoot('08-mobile', { width: 390, height: 844, path: '/app/today' });
await shoot('33-mobile-dark', {
  width: 390,
  height: 844,
  theme: 'dark',
  path: '/app/today',
});
await shoot('34-mobile-capture', {
  width: 390,
  height: 844,
  path: '/app/today',
  action: async (page) => {
    await page.getByRole('button', { name: 'חדשה' }).click();
    await page.waitForTimeout(300);
  },
});
await shoot('35-mobile-inbox', { width: 390, height: 844, path: '/app/inbox' });
await shoot('36-mobile-drawer', {
  width: 390,
  height: 844,
  path: '/app/today',
  action: async (page) => {
    await page.getByRole('button', { name: 'תפריט' }).click();
    await page.waitForTimeout(300);
  },
});
/** The narrowest phone still in use. If the tab bar survives 320px it survives. */
await shoot('37-mobile-320', { width: 320, height: 720, path: '/app/today' });
await shoot('09-landing', { width: 1280, height: 900, path: '/' });
await shoot('10-login', { width: 1280, height: 700, path: '/login' });

await browser.close();
await db.session.deleteMany({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
await db.$disconnect();
