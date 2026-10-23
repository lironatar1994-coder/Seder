/**
 * Landing-page media: stills and short looping clips of the real app.
 *
 * Signs in the seeded demo account the same way scripts/shots.mjs does (a
 * minted session row, no typed credentials), drives the interface with
 * Playwright and records it through the CDP screencast. Frames arrive only when
 * something repaints, so each one is held for exactly as long as it stayed on
 * screen, then ffmpeg resamples the sequence to a steady 30fps H.264 loop.
 *
 *   npm run db:seed
 *   npm run dev            (or: npx next start -p 3000)
 *   node scripts/landing-media.mjs [only-this-clip ...]
 *
 * Output: public/landing/*.{png,mp4} plus a GIF of every clip in
 * .local-artifacts/landing-gifs/ for sharing outside the page.
 */

import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appBase } from './base-path.mjs';

const BASE = appBase(process.env.SHOT_BASE ?? 'http://localhost:3000');
const OUT = 'public/landing';
const GIFS = '.local-artifacts/landing-gifs';
const ONLY = process.argv.slice(2);
const db = new PrismaClient();

mkdirSync(OUT, { recursive: true });
mkdirSync(GIFS, { recursive: true });

const user = await db.user.findUnique({ where: { email: 'demo@seder.app' } });
if (!user) throw new Error('Seed first: npm run db:seed');

// Seeded times are fixed, so in the evening every timed task has already slid
// into "באיחור". Move today's timed tasks a little ahead of the clock instead.
const now = new Date();
const later = (hours) => `${String(Math.min(23, now.getHours() + hours)).padStart(2, '0')}:00`;
await db.task.updateMany({ where: { userId: user.id, title: 'לסיים את המצגת לרבעון' }, data: { scheduledTime: later(2) } });
await db.task.updateMany({ where: { userId: user.id, title: 'ישיבת צוות שבועית' }, data: { scheduledTime: later(1) } });

const token = randomBytes(32).toString('base64url');
await db.session.create({
  data: {
    tokenHash: createHash('sha256').update(token).digest('hex'),
    userId: user.id,
    expiresAt: new Date(Date.now() + 3600_000),
  },
});

const browser = await chromium.launch();

async function open({ width = 1280, height = 800, theme = 'light', scale = 2, path = '/app/today' } = {}) {
  const phone = width < 768;
  const context = await browser.newContext({
    viewport: { width, height },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    colorScheme: theme,
    deviceScaleFactor: scale,
    hasTouch: phone,
    isMobile: phone,
  });
  await context.addCookies([{ name: 'seder_session', value: token, domain: 'localhost', path: '/', httpOnly: true }]);
  await context.addInitScript(({ theme: value, userId }) => {
    try {
      localStorage.setItem('seder-theme', value);
      // The one-time WhatsApp introduction would sit over every capture.
      localStorage.setItem(`seder:whatsapp-introduction:${userId}`, 'seen');
    } catch {}
  }, { theme, userId: user.id });
  const page = await context.newPage();
  await go(page, path);
  return page;
}

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.locator('main').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  // A dialog left open by a first-run hint is not part of any shot.
  for (let i = 0; i < 2; i += 1) {
    if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
  }
}

/** Visible pacing: a person, not a test runner. */
async function typeSlowly(page, text, delay = 70) {
  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(delay + (char === ' ' ? 60 : 0));
  }
}

/** Smooth pointer travel so the cursor-less recording still reads as motion. */
async function glide(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
  await page.waitForTimeout(180);
}

async function still(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`✓ ${name}.png`);
}

/**
 * Records `script` and writes `${name}.mp4`. `crop` is in CSS pixels.
 */
async function clip(page, name, script, { crop, hold = 1600, width = 1200 } = {}) {
  if (ONLY.length && !ONLY.includes(name)) return;
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const vp = page.viewportSize();
  const dpr = await page.evaluate(() => devicePixelRatio);
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 94,
    maxWidth: vp.width * dpr,
    maxHeight: vp.height * dpr,
    everyNthFrame: 1,
  });
  await page.waitForTimeout(700);
  await script();
  await page.waitForTimeout(hold);
  await cdp.send('Page.stopScreencast');

  const dir = join(tmpdir(), `seder-clip-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const lines = [];
  frames.forEach((frame, i) => {
    const file = join(dir, `${String(i).padStart(5, '0')}.jpg`).replace(/\\/g, '/');
    writeFileSync(file, Buffer.from(frame.data, 'base64'));
    const next = frames[i + 1]?.t ?? frame.t + hold / 1000;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - frame.t).toFixed(4)}`);
  });
  lines.push(lines.at(-2));
  writeFileSync(join(dir, 'list.txt'), lines.join('\n'));

  // Frame size comes from the screencast, which can be smaller than viewport×dpr.
  const meta = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', join(dir, '00000.jpg')]).toString();
  const k = Number(meta.trim()) / vp.width;
  const filters = ['fps=30'];
  if (crop) filters.push(`crop=${Math.round(crop.w * k)}:${Math.round(crop.h * k)}:${Math.round(crop.x * k)}:${Math.round(crop.y * k)}`);
  filters.push(`scale=${width}:-2:flags=lanczos`);

  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    '-vf', filters.join(','), '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', join(OUT, `${name}.mp4`)]);
  // The poster is the first frame, so reduced motion and slow networks see the
  // starting state of the same recording rather than a blank box.
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(OUT, `${name}.mp4`), '-frames:v', '1',
    '-c:v', 'libwebp', '-quality', '82', join(OUT, `${name}.webp`)]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(OUT, `${name}.mp4`), '-vf',
    'fps=15,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    '-loop', '0', join(GIFS, `${name}.gif`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`✓ ${name}.mp4 (${frames.length} frames)`);
}

const want = (name) => !ONLY.length || ONLY.includes(name);

// ── Stills ─────────────────────────────────────────────────────────────────
if (want('stills')) {
  for (const theme of ['light', 'dark']) {
    const page = await open({ width: 1440, height: 900, theme });
    await still(page, `hero-desktop-${theme}`);
    await page.context().close();
    const phone = await open({ width: 390, height: 844, theme, scale: 3 });
    await still(phone, `hero-phone-${theme}`);
    await phone.context().close();
  }
}

// ── Clips ──────────────────────────────────────────────────────────────────
{
  const page = await open();
  const main = { x: 40, y: 64, w: 940, h: 640 };

  await clip(page, 'quick-add', async () => {
    await glide(page, page.getByRole('button', { name: /משימה חדשה/ }).first());
    await page.getByRole('button', { name: /משימה חדשה/ }).first().click();
    await page.waitForTimeout(500);
    await typeSlowly(page, 'להתקשר לסבתא היום בשעה 21:30 #בית @טלפון !2');
    await page.waitForTimeout(1300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
  }, { crop: main, hold: 1800 });

  await go(page, '/app/today');
  await clip(page, 'complete', async () => {
    for (const title of ['לקנות חלב, לחם וקפה', 'להתקשר למוסך לגבי הטיפול']) {
      const box = page.getByRole('checkbox', { name: `סימון כהושלם: ${title}` }).or(page.getByRole('button', { name: `סימון כהושלם: ${title}` })).first();
      await glide(page, box);
      await box.click();
      await page.waitForTimeout(1500);
    }
  }, { crop: main, hold: 1400 });

  await go(page, '/app/today');
  await clip(page, 'search', async () => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(600);
    await typeSlowly(page, 'דרכון', 120);
    await page.waitForTimeout(1500);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await typeSlowly(page, 'לוח שנה', 110);
    await page.waitForTimeout(900);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);
  }, { hold: 1200 });

  await go(page, '/app/calendar');
  await clip(page, 'calendar', async () => {
    await page.waitForTimeout(900);
    const week = page.getByRole('link', { name: 'שבוע', exact: true });
    await glide(page, week);
    await week.click();
    await page.waitForTimeout(1800);
    const month = page.getByRole('link', { name: 'חודש', exact: true });
    await glide(page, month);
    await month.click();
    await page.waitForTimeout(1200);
  }, { crop: { x: 0, y: 64, w: 1000, h: 736 }, hold: 1200 });

  await go(page, '/app/settings/appearance');
  await clip(page, 'theme', async () => {
    const swatches = page.getByRole('radiogroup', { name: 'צבע ראשי' }).getByRole('radio');
    const original = await page.getByRole('radiogroup', { name: 'צבע ראשי' }).locator('[aria-checked="true"]').getAttribute('data-accent');
    for (const i of [2, 4, 6]) {
      await glide(page, swatches.nth(i));
      await swatches.nth(i).click();
      await page.waitForTimeout(900);
    }
    const dark = page.getByRole('radiogroup', { name: 'בהירות' }).getByRole('radio', { name: /כהה/ });
    await glide(page, dark);
    await dark.click();
    await page.waitForTimeout(1300);
    await glide(page, page.locator(`[data-accent="${original}"]`).first());
    await page.locator(`[data-accent="${original}"]`).first().click();
    await page.waitForTimeout(1100);
    await page.getByRole('radiogroup', { name: 'בהירות' }).getByRole('radio', { name: /בהיר/ }).click();
  }, { hold: 1300 });

  await page.context().close();
}

if (want('board')) {
  const wide = await open({ width: 1600, height: 820 });
  const trip = await wide.locator('aside.rail').getByRole('link', { name: /טיול ליוון/ }).getAttribute('href');
  await go(wide, trip.replace(/^\/seder/, ''));
  await wide.getByRole('button', { name: 'לוח', exact: true }).click();
  await wide.waitForTimeout(800);
  await clip(wide, 'board', async () => {
    const grip = wide.getByRole('button', { name: 'גרירת להזמין כרטיסים למוזיאון' });
    const target = wide.getByRole('region', { name: 'בשטח' });
    const from = await grip.boundingBox();
    const to = await target.boundingBox();
    await wide.mouse.move(from.x + from.width / 2, from.y + from.height / 2, { steps: 12 });
    await wide.waitForTimeout(250);
    await wide.mouse.down();
    await wide.mouse.move(from.x - 20, from.y + 10, { steps: 6 });
    await wide.mouse.move(to.x + to.width / 2, to.y + 140, { steps: 40 });
    await wide.waitForTimeout(450);
    await wide.mouse.up();
    await wide.waitForTimeout(1400);
  }, { crop: { x: 0, y: 64, w: 1320, h: 660 }, hold: 1200 });
  await wide.context().close();

}

if (want('phone')) {
  const page = await open({ width: 390, height: 844, scale: 3 });
  await clip(page, 'phone', async () => {
    const add = page.getByRole('button', { name: /הוספת משימה|משימה חדשה/ }).filter({ visible: true }).last();
    await add.tap();
    await page.waitForTimeout(700);
    await typeSlowly(page, 'לאסוף את הילדים היום בשעה 16:30 !1', 80);
    await page.waitForTimeout(1300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
  }, { hold: 1600, width: 720 });
  await page.context().close();
}

await browser.close();
await db.$disconnect();
