import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { BASE_PATH } from '../playwright.config';
import { db } from '../src/server/db';
import { today, addDays } from '../src/lib/dates';
const at = (path: string) => `${BASE_PATH}${path}`;
const shots = '.impeccable/review/filters';
mkdirSync(shots, { recursive: true });

async function register(page: Page) {
  const email = `filter-directory-${Date.now()}-${Math.random()}@seder.test`;
  await page.goto(at('/register'));
  await page.getByLabel('שם', { exact: true }).fill('בדיקת רשימות');
  await page.getByLabel('אימייל', { exact: true }).fill(email);
  await page.getByLabel('סיסמה', { exact: true }).fill('filter-directory-123');
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/**');
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  return db.user.findUniqueOrThrow({ where: { email } });
}

test('filter directory opens useful lists, edits criteria and saves a live search', async ({ page }) => {
  const user = await register(page);
  await db.task.createMany({ data: [
    { userId: user.id, title: 'דחוף מאתמול', position: 'a1', priority: 1, whenBucket: 'SCHEDULED', scheduledFor: addDays(today(), -1) },
    { userId: user.id, title: 'רגיל מאתמול', position: 'a2', priority: 3, whenBucket: 'SCHEDULED', scheduledFor: addDays(today(), -1) },
    { userId: user.id, title: 'משימה ללא תאריך', position: 'a3', whenBucket: 'ANYTIME' },
  ] });
  await page.goto(at('/app/filters'));
  await expect(page.getByRole('heading', { name: 'מסננים ותוויות', level: 1 })).toBeVisible();
  await expect(page.getByTestId('task-list')).toHaveCount(0);
  await expect(page.locator('select[name="priority"]')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${shots}/directory-desktop.png`, animations: 'disabled' });
  await page.locator('main').getByRole('link', { name: /^באיחור/ }).click();
  await expect(page.getByRole('heading', { name: 'באיחור', level: 1 })).toBeVisible();
  await expect(page.locator('select[name="priority"]')).toBeHidden();
  await expect(page.getByTestId('task-list')).toContainText('דחוף מאתמול');
  await expect(page.getByTestId('task-list')).toContainText('רגיל מאתמול');
  await expect(page.getByTestId('task-list')).not.toContainText('משימה ללא תאריך');
  await page.getByRole('button', { name: 'עריכת מסנן', exact: true }).click();
  await page.locator('select[name="priority"]').selectOption('1');
  await page.getByRole('button', { name: 'הצגת משימות', exact: true }).click();
  await expect(page.getByTestId('task-list')).not.toContainText('רגיל מאתמול');
  await expect(page.getByRole('list', { name: 'תנאי המסנן' })).toContainText('עדיפות: דחוף');
  await page.getByRole('button', { name: 'שמירת מסנן', exact: true }).click();
  await page.getByLabel('שם המסנן', { exact: true }).fill('דחוף ובאיחור');
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await page.waitForURL('**/filters?id=*');
  const savedUrl = page.url();
  const saved = await db.savedFilter.findFirstOrThrow({ where: { userId: user.id, name: 'דחוף ובאיחור' } });
  expect(JSON.parse(saved.config)).toMatchObject({ priority: '1', when: 'overdue' });
  await db.task.create({ data: { userId: user.id, title: 'עוד משימה מתאימה', priority: 1, position: 'a4', whenBucket: 'SCHEDULED', scheduledFor: addDays(today(), -2) } });
  await page.reload();
  await expect(page.getByTestId('task-list')).toContainText('עוד משימה מתאימה');
  await page.getByRole('button', { name: 'עריכת מסנן', exact: true }).click();
  await page.locator('select[name="priority"]').selectOption('3');
  await page.getByRole('button', { name: 'שמירת שינויים', exact: true }).click();
  await expect(page.getByTestId('task-list')).toContainText('רגיל מאתמול');
  await expect(page).toHaveURL(savedUrl);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'דחוף ובאיחור', level: 1 })).toBeVisible();
  await expect(page.getByTestId('task-list')).not.toContainText('דחוף מאתמול');
  expect(await db.savedFilter.count({ where: { userId: user.id } })).toBe(1);
  await page.getByRole('button', { name: 'אפשרויות המסנן', exact: true }).click();
  await page.getByRole('menuitem', { name: 'מחיקת מסנן', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/app/filters$'));
  await expect(page.locator('main').getByRole('link', { name: 'דחוף ובאיחור', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('task-list')).toHaveCount(0);
  await page.goto(savedUrl);
  await expect(page.getByRole('heading', { name: 'דחוף ובאיחור', level: 1 })).toHaveCount(0);
});

test('directory creates labels inline and an empty applied filter stays a task list', async ({ page }) => {
  const user = await register(page);
  await page.goto(at('/app/filters'));
  await page.getByRole('button', { name: 'תווית חדשה', exact: true }).click();
  await page.getByLabel('שם התווית', { exact: true }).fill('שיחות עם לקוחות');
  await page.getByRole('combobox', { name: 'צבע', exact: true }).selectOption('teal');
  await page.getByRole('button', { name: 'יצירת תווית', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('בלי רווחים');
  await page.getByLabel('שם התווית', { exact: true }).fill('שיחות_לקוחות');
  await page.getByRole('button', { name: 'יצירת תווית', exact: true }).click();
  await expect(page.locator('main').getByRole('link', { name: 'שיחות_לקוחות', exact: true })).toBeVisible();
  await expect(page.getByLabel('שם התווית', { exact: true })).toHaveCount(0);
  expect(await db.label.count({ where: { userId: user.id, name: 'שיחות_לקוחות', color: 'teal' } })).toBe(1);
  await page.locator('main').getByRole('link', { name: 'שיחות_לקוחות', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'שיחות_לקוחות', level: 1 })).toBeVisible();
  await page.goto(at('/app/filters?new=1'));
  await expect(page.getByTestId('task-list')).toHaveCount(0);
  await page.getByRole('button', { name: 'הצגת משימות', exact: true }).click();
  await expect(page).toHaveURL(/filters\?applied=1$/);
  await expect(page.getByRole('heading', { name: 'תוצאות המסנן', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'תנאי המסנן' })).toContainText('כל המשימות הפתוחות');
  await expect(page.locator('select[name="priority"]')).toBeHidden();
});

test('phone directory, filter form and navigation fit in both themes with fixed search and capture', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await context.newPage();
  await register(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(choice => { localStorage.setItem('seder-theme', choice); document.documentElement.dataset.theme = choice; }, theme);
      for (const [name, path] of [['directory', '/app/filters'], ['new', '/app/filters?new=1'], ['results', '/app/filters?preset=overdue']]) {
        await page.goto(at(path));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (name === 'results') await expect(page.locator('.mobile-add')).toBeVisible();
        else await expect(page.locator('.mobile-add')).toBeHidden();
        await page.evaluate(() => document.fonts.ready);
        if (width === 390 || theme === 'light') await page.screenshot({ path: `${shots}/${name}-${width}-${theme}.png`, animations: 'disabled' });
      }
      await page.getByRole('button', { name: 'רשימות', exact: true }).click();
      const search = page.locator('.rail-search'); const capture = page.locator('.rail-create');
      const before = [(await search.boundingBox())!.y, (await capture.boundingBox())!.y];
      await page.locator('.rail-nav').evaluate(node => { node.scrollTop = node.scrollHeight; });
      expect((await search.boundingBox())!.y).toBeCloseTo(before[0], 1);
      expect((await capture.boundingBox())!.y).toBeCloseTo(before[1], 1);
      await expect(page.locator('.rail').getByRole('link', { name: 'היסטוריה', exact: true })).toBeVisible();
      await page.locator('.rail-nav').evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: `${shots}/navigation-${width}-${theme}.png`, animations: 'disabled' });
      await page.getByRole('button', { name: 'סגירה', exact: true }).click();
    }
  }
  expect(errors).toEqual([]);
  await context.close();
});
