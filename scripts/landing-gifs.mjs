/**
 * Exports the landing page's animated scenes as looping GIFs and MP4s, for
 * sharing outside the page (social posts, WhatsApp, decks).
 *
 * The scenes are live components, so this records the running page: each
 * scene is scrolled into view (which restarts its clock), its second loop is
 * captured through the CDP screencast, cropped to the scene, and resampled by
 * ffmpeg. Recording the second loop skips the settle from the still frame.
 *
 *   npm run dev
 *   node scripts/landing-gifs.mjs [scene ...]
 *
 * Output: .local-artifacts/landing-gifs/<scene>.{gif,mp4}
 */

import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appBase } from './base-path.mjs';

const BASE = appBase(process.env.SHOT_BASE ?? 'http://localhost:3000');
const OUT = '.local-artifacts/landing-gifs';
const ONLY = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
// Under the `lg` breakpoint every scene sits inline in the page flow.
const page = await browser.newPage({ viewport: { width: 640, height: 900 }, deviceScaleFactor: 2, locale: 'he-IL' });
await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
// The sticky mobile call to action is page chrome, not part of any scene.
await page.addStyleTag({ content: '.fixed.bottom-0 { display: none !important; }' });

const names = await page.$$eval('[data-scene]', (nodes) => nodes.map((node) => node.dataset.scene));

for (const name of names) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  const scene = page.locator(`[data-scene="${name}"]`).first();
  const loop = Number(await scene.getAttribute('data-loop'));

  // Away and back, so the clock restarts from zero.
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);

  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
  await scene.evaluate((node) => node.scrollIntoView({ block: 'center' }));
  const shown = Date.now() / 1000;
  await page.waitForTimeout(loop * 2 + 300);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  const box = await scene.boundingBox();

  // Keep exactly the second loop: [shown + loop, shown + 2·loop).
  const from = shown + loop / 1000;
  const to = from + loop / 1000;
  const kept = [];
  const before = frames.filter((frame) => frame.t <= from).at(-1);
  if (before) kept.push({ ...before, t: from });
  kept.push(...frames.filter((frame) => frame.t > from && frame.t < to));

  const dir = join(tmpdir(), `seder-scene-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const lines = [];
  kept.forEach((frame, i) => {
    const file = join(dir, `${String(i).padStart(5, '0')}.jpg`).replace(/\\/g, '/');
    writeFileSync(file, Buffer.from(frame.data, 'base64'));
    const next = kept[i + 1]?.t ?? to;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - frame.t).toFixed(4)}`);
  });
  lines.push(lines.at(-2));
  writeFileSync(join(dir, 'list.txt'), lines.join('\n'));

  const width = Number(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', join(dir, '00000.jpg')]).toString().trim());
  const k = width / page.viewportSize().width;
  const crop = `crop=${Math.round(box.width * k)}:${Math.round(box.height * k)}:${Math.round(box.x * k)}:${Math.round(box.y * k)}`;

  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    '-vf', `fps=30,${crop},scale=1080:-2:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(OUT, `${name}.mp4`)]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(OUT, `${name}.mp4`), '-vf',
    'fps=20,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    '-loop', '0', join(OUT, `${name}.gif`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`✓ ${name} (${kept.length} frames, ${loop}ms)`);
}

await browser.close();
