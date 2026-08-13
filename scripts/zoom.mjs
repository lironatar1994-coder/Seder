/** Crops a single element to disk for close visual inspection.
 *  node scripts/zoom.mjs <url-path> <css-selector> <out-name> */

import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { appBase } from './base-path.mjs';

const [, , path = '/app/today', selector = 'body', name = 'zoom'] = process.argv;
const BASE = appBase(process.env.SHOT_BASE ?? 'http://localhost:3100');
const db = new PrismaClient();

const user = await db.user.findUnique({ where: { email: 'demo@seder.app' } });
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
  deviceScaleFactor: 4,
});
await context.addCookies([
  { name: 'seder_session', value: token, domain: 'localhost', path: '/', httpOnly: true },
]);
const page = await context.newPage();
await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });

if (process.env.ZOOM_OPEN_COMPOSER) {
  await page.getByRole('button', { name: 'משימה חדשה' }).click();
  await page.getByLabel('משימה חדשה').fill(process.env.ZOOM_TEXT ?? 'בדיקה מחר');
}

await page.waitForTimeout(400);
await page.locator(selector).first().screenshot({ path: `screenshots/${name}.png` });
console.log(`✓ screenshots/${name}.png`);

await browser.close();
await db.session.deleteMany({
  where: { tokenHash: createHash('sha256').update(token).digest('hex') },
});
await db.$disconnect();
