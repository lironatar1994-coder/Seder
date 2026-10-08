import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { BASE_PATH } from '../playwright.config';
import { addDays, today, wallTimeInstant } from '../src/lib/dates';

const db = new PrismaClient();
const at = (path: string) => `${BASE_PATH}${path}`;
test.afterAll(async () => db.$disconnect());

async function register(page: Page) {
  const email = `layout-${Date.now()}-${Math.random().toString(16).slice(2)}@seder.test`;
  await page.goto(at('/register'));
  await page.getByLabel('שם', { exact: true }).fill('בדיקת עיצוב');
  await page.getByLabel('אימייל', { exact: true }).fill(email);
  await page.getByLabel('סיסמה', { exact: true }).fill('layout-test-123');
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/today');
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  return db.user.findUniqueOrThrow({ where: { email } });
}

test('dates and hours have separate urgency, consistent picker colors and a working no-date action', async ({ page }) => {
  const base = today();
  await page.clock.install({ time: wallTimeInstant(base, '10:00')! });
  const user = await register(page);
  for (const [index, task] of [
    { title: 'משימה מאתמול', day: -1, time: '09:00' },
    { title: 'משימה מהבוקר', day: 0, time: '09:00' },
    { title: 'משימה להיום', day: 0, time: '11:00' },
    { title: 'משימה למחר', day: 1, time: '08:00' },
    { title: 'משימה השבוע', day: 3, time: '08:00' },
    { title: 'משימה להמשך', day: 10, time: '08:00' },
  ].entries()) await db.task.create({ data: { userId: user.id, title: task.title, position: `a${index}`, whenBucket: 'SCHEDULED', scheduledFor: addDays(base, task.day), scheduledTime: task.time } });
  await page.goto(at('/app/inbox'));
  const row = (title: string) => page.locator('.task-row').filter({ has: page.getByRole('button', { name: `פתיחת ${title}`, exact: true }) });
  await expect(row('משימה מאתמול').locator('[data-date-tone="overdue"]')).toBeVisible();
  await expect(row('משימה מאתמול').locator('[data-time-overdue="true"]')).toHaveCount(0);
  await expect(row('משימה מהבוקר').locator('[data-date-tone="none"]')).toBeVisible();
  await expect(row('משימה מהבוקר').locator('[data-time-overdue="true"]')).toBeVisible();
  for (const [title, tone] of [['משימה להיום', 'today'], ['משימה למחר', 'tomorrow'], ['משימה השבוע', 'week'], ['משימה להמשך', 'later']]) {
    await expect(row(title).locator(`[data-date-tone="${tone}"]`)).toBeVisible();
  }
  const colors = await page.locator('[data-schedule-chip] [data-date-tone]').evaluateAll(elements => elements.map(element => getComputedStyle(element).color));
  expect(new Set(colors).size).toBe(6);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const geometry = await page.locator('.task-row').evaluateAll(rows => rows.map(row => {
      const title = row.querySelector<HTMLElement>('.task-title')!;
      const checkbox = row.querySelector<HTMLElement>('[role="checkbox"]')!;
      const a = title.getBoundingClientRect(), b = checkbox.getBoundingClientRect();
      return { titleRight: a.right, centerDifference: Math.abs(a.top + 12 - (b.top + b.height / 2)), font: parseFloat(getComputedStyle(title).fontSize) };
    }));
    expect(Math.max(...geometry.map(item => item.titleRight)) - Math.min(...geometry.map(item => item.titleRight))).toBeLessThan(1);
    expect(geometry.every(item => item.centerDifference <= 1 && item.font >= 17)).toBe(true);
    await page.screenshot({ path: `.local-artifacts/layout-refinement/inbox-${width}.png`, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await row('משימה להיום').getByRole('button', { name: 'פתיחת משימה להיום', exact: true }).click();
  await page.getByRole('group', { name: 'מתוזמן ל', exact: true }).getByRole('button', { name: 'היום', exact: true }).click();
  const picker = page.getByTestId('date-picker');
  await expect(picker.getByRole('button', { name: 'היום', exact: true })).toHaveAttribute('data-date-tone', 'today');
  await expect(picker.getByRole('button', { name: /^מחר / })).toHaveAttribute('data-date-tone', 'tomorrow');
  await page.screenshot({ path: '.local-artifacts/layout-refinement/date-picker-390.png', animations: 'disabled' });
  await picker.getByRole('button', { name: 'ללא תאריך', exact: true }).click();
  await expect(page.getByRole('group', { name: 'מתוזמן ל', exact: true })).toContainText('בכל עת');
  await expect(page.getByRole('button', { name: 'עריכת שעה', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'סגירה', exact: true }).click();
  await page.reload();
  await expect(row('משימה להיום').locator('[data-schedule-chip]')).toHaveCount(0);
  await page.clock.setSystemTime(wallTimeInstant(base, '12:00')!);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row('משימה מהבוקר').locator('[data-time-overdue="true"]')).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: '.local-artifacts/layout-refinement/inbox-dark-390.png', animations: 'disabled' });
});

test('long mobile menu scrolls only its destinations while search, add and account stay fixed', async ({ page }) => {
  const user = await register(page);
  await db.label.createMany({ data: Array.from({ length: 30 }, (_, index) => ({ userId: user.id, name: `תווית ${index + 1}`, position: `a${String(index).padStart(2, '0')}` })) });
  await page.goto(at('/app/inbox'));
  for (const width of [320, 390, 576]) {
    await page.setViewportSize({ width, height: 740 });
    const menu = page.getByRole('button', { name: 'רשימות', exact: true });
    await expect(menu).toContainText('רשימות');
    await menu.click();
    const rail = page.locator('aside.rail');
    await expect.poll(async () => Math.abs((await rail.boundingBox())!.x)).toBeLessThan(0.01);
    const search = rail.locator('.rail-search');
    const add = rail.getByRole('button', { name: 'הוספת משימה', exact: true });
    await expect(add).toContainText('הוספת משימה');
    expect(await search.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    const before = { search: await search.boundingBox(), add: await add.boundingBox(), account: await rail.locator('.rail-account').boundingBox() };
    if (width === 390) await page.screenshot({ path: '.local-artifacts/layout-refinement/menu-top-390.png', animations: 'disabled' });
    await expect(rail.getByRole('link', { name: /^תיבה נכנסת/ })).toBeHidden();
    await expect(rail.getByRole('link', { name: 'היום', exact: true })).toBeHidden();
    const labels = rail.getByRole('button', { name: 'תוויות', exact: true });
    if (await labels.getAttribute('aria-expanded') === 'false') await labels.click();
    await rail.locator('nav').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(rail.getByRole('link', { name: 'תווית 30', exact: true })).toBeInViewport();
    const after = { search: await search.boundingBox(), add: await add.boundingBox(), account: await rail.locator('.rail-account').boundingBox() };
    for (const element of ['search', 'add', 'account'] as const) {
      expect(after[element]!.y).toBeCloseTo(before[element]!.y, 1);
      expect(after[element]!.x).toBeCloseTo(before[element]!.x, 1);
    }
    expect(before.search!.height).toBeGreaterThanOrEqual(44);
    expect(before.add!.width).toBeGreaterThanOrEqual(43.9);
    await page.screenshot({ path: `.local-artifacts/layout-refinement/menu-${width}.png`, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await search.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await menu.click();
    await add.click();
    await expect(page.getByTestId('task-composer')).toBeVisible();
    await page.getByRole('button', { name: 'סגירת המשימה החדשה', exact: true }).click();
  }
});
