/** Loads pages as the demo user and reports console errors / page errors.
 *  node scripts/console-check.mjs [path ...] */

import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { appBase } from './base-path.mjs';

const BASE = appBase(process.env.SHOT_BASE ?? 'http://localhost:3000');
const paths = process.argv.slice(2);
const targets = paths.length ? paths : ['/app/today', '/app/calendar', '/app/calendar?v=week'];

const db = new PrismaClient();
const user = await db.user.findUnique({ where: { email: 'demo@seder.app' } });
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
await db.session.create({
  data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) },
});

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
await context.addCookies([
  { name: 'seder_session', value: token, domain: 'localhost', path: '/', httpOnly: true },
]);

let problems = 0;

for (const target of targets) {
  const page = await context.newPage();
  const found = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') found.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => found.push(`[pageerror] ${e.message}`));

  /* The console's own message for a bad response is "Failed to load resource"
     with no URL, which tells you something is broken and nothing about what.
     The response event has the URL, so name it. */
  page.on('response', (response) => {
    if (response.status() < 400) return;
    found.push(`[${response.status()}] ${new URL(response.url()).pathname}`);
  });

  /* Not `networkidle`: it waits for 500ms of silence that a page holding any
     long-lived connection never gives, and hangs the whole run on one route.
     The fixed settle below is what this actually needs — hydration errors
     surface within it. */
  await page.goto(`${BASE}${target}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);

  console.log(`\n=== ${target} ===`);
  if (found.length === 0) console.log('  clean');
  found.forEach((f) => console.log('  ' + (process.env.FULL ? f : f.slice(0, 400))));
  problems += found.length;
  await page.close();
}

await browser.close();
await db.session.deleteMany({ where: { tokenHash } });
await db.$disconnect();
console.log(`\n${problems} problem(s)`);
