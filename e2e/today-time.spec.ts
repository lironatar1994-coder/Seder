import { test, expect, type Page } from '@playwright/test';
import { BASE_PATH } from '../playwright.config';
import { addDays, formatFullDate, today, wallTimeInstant } from '../src/lib/dates';

async function register(page: Page) {
  await page.goto(`${BASE_PATH}/register`);
  await page.getByLabel('שם', { exact: true }).fill('בדיקת היום — נתוני דוגמה');
  await page.getByLabel('אימייל', { exact: true }).fill(`today-time-${Date.now()}-${Math.random().toString(16).slice(2)}@seder.test`);
  await page.getByLabel('סיסמה', { exact: true }).fill('today-time-test-123');
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/today');
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
}

async function add(page: Page, text: string, phone = false) {
  await (phone ? page.locator('.mobile-add') : page.getByRole('button', { name: /^משימה חדשה/ })).click();
  await page.getByLabel('משימה חדשה', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'הוספה', exact: true }).click();
  await expect(page.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: phone ? 'סגירת המשימה החדשה' : 'ביטול', exact: true }).click();
}

test('elapsed hours regroup live, preserve drafts and respond to time edits and focus', async ({ page }) => {
  const day = today();
  await page.clock.install({ time: wallTimeInstant(day, '09:58')! });
  await register(page);
  await add(page, 'להכין תוכנית היום בשעה 10:00');
  await add(page, 'לקרוא מסמך היום בשעה 23:00');
  await add(page, 'לסדר את הבית היום');
  const before = wallTimeInstant(day, '09:59')!.getTime() + 30_000;
  await page.clock.pauseAt(before);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const current = page.locator('[data-task-group="today"]');
  const late = page.locator('[data-task-group="overdue"]');
  await expect(current).toContainText('להכין תוכנית');
  await page.getByRole('button', { name: /^משימה חדשה/ }).click();
  await page.getByLabel('משימה חדשה', { exact: true }).fill('טיוטה שלא נשמרה');
  await page.clock.runFor(91_000);
  await expect(late).toContainText('להכין תוכנית');
  await expect(late).toContainText('באיחור');
  await expect(current).not.toContainText('להכין תוכנית');
  await expect(current).toContainText('לקרוא מסמך');
  await expect(current).toContainText('לסדר את הבית');
  await expect(late.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByLabel('משימה חדשה', { exact: true })).toHaveValue('טיוטה שלא נשמרה');
  await page.getByRole('button', { name: 'ביטול', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.local-artifacts/today-spacing-desktop.png', fullPage: true });
  await late.getByRole('button', { name: 'פתיחת להכין תוכנית', exact: true }).click();
  await page.getByRole('button', { name: 'עריכת שעה', exact: true }).click();
  await page.getByLabel('שעה', { exact: true }).fill('22:00');
  await page.getByRole('button', { name: 'שמור', exact: true }).click();
  await expect(page.getByRole('button', { name: 'עריכת שעה', exact: true })).toHaveText('22:00');
  await page.getByRole('button', { name: 'סגירה', exact: true }).click();
  await expect(current).toContainText('להכין תוכנית');
  await expect(late).toHaveCount(0);
  await page.clock.setSystemTime(wallTimeInstant(day, '23:01')!);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(late).toContainText('לקרוא מסמך');
  await expect(late).toContainText('להכין תוכנית');
  await expect(current).toContainText('לסדר את הבית');
  await expect(page.getByTestId('task-list').locator('.task-row')).toHaveCount(3);
});

test('compact phone rows preserve touch targets, readable text and viewport width', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://localhost:3100', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: wallTimeInstant(today(), '08:58')! });
  await register(page);
  const yesterday = formatFullDate(addDays(today(), -1));
  for (const value of [
    `מקווה ${yesterday} בשעה 09:15`,
    `לקחת את ליבי מרים לגן ${yesterday} בשעה 07:30`,
    'לדבר עם יצחק היום בשעה 14:00',
    'ללכת לביטוח לאומי עם יעל היום בשעה 10:00',
    'לטבול כלים היום בשעה 12:00',
    'לטפל ברכב היום בשעה 11:00',
    'תפילה היום בשעה 19:00 כל יום',
    'לקרוא ספר היום',
  ]) await add(page, value, true);
  const before = wallTimeInstant(today(), '09:00')!;
  await page.clock.pauseAt(before);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('[data-task-group="today"] .task-row')).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.local-artifacts/today-spacing-mobile-390.png', fullPage: true });
  const geometry = await page.locator('.task-row').evaluateAll(rows => rows.map(row => {
    const button = row.querySelector<HTMLButtonElement>('button[aria-label^="פתיחת "]')!;
    const title = button.querySelector<HTMLElement>('[dir="auto"]')!;
    return { row: row.getBoundingClientRect().height, target: button.getBoundingClientRect().height, font: parseFloat(getComputedStyle(title).fontSize) };
  }));
  expect(geometry.every(item => item.row >= 44 && item.row <= 70 && item.target >= 44 && item.font >= 16)).toBe(true);
  for (const width of [320, 576]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local-artifacts/today-spacing-mobile-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local-artifacts/today-spacing-mobile-dark.png', fullPage: true });
  await page.clock.setSystemTime(wallTimeInstant(today(), '19:41')!);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('[data-task-group="overdue"] .task-row')).toHaveCount(7);
  await expect(page.locator('[data-task-group="today"]')).toContainText('לקרוא ספר');
  await page.screenshot({ path: '.local-artifacts/today-spacing-elapsed.png', fullPage: true });
  expect(errors).toEqual([]);
  await context.close();
});
