import { test, expect, type Page } from '@playwright/test';
import { BASE_PATH } from '../playwright.config';
import { addDays, formatFullDate, today, wallTimeInstant } from '../src/lib/dates';
import { PrismaClient } from '@prisma/client';
import { rescheduleDate } from '../src/lib/reschedule';

test('overdue header reschedules the group to today and clears elapsed times without changing deadlines', async ({ page }) => {
  await page.clock.install({ time: wallTimeInstant(today(), '12:00')! });
  await register(page);
  await add(page, `משימה מאתמול ${formatFullDate(addDays(today(), -1))} עד מחר`);
  await add(page, 'משימה מהבוקר היום בשעה 09:00');
  await add(page, 'משימה להמשך היום בשעה 18:00');
  const late = page.locator('[data-task-group="overdue"]');
  const button = late.getByRole('button', { name: 'תזמון מחדש של המשימות שבאיחור' });
  await expect(button).toBeVisible();
  await page.screenshot({ path: '.local-artifacts/overdue-reschedule-desktop.png' });
  await button.click();
  await expect(page.getByTestId('toasts')).toContainText('2 משימות תוזמנו מחדש');
  await expect(late).toHaveCount(0);
  await expect(page.getByTestId('task-list').locator('.task-row')).toHaveCount(3);
  await expect(page.getByTestId('task-list')).toContainText('18:00');
  await expect(page.getByTestId('task-list')).not.toContainText('09:00');
  await expect(page.getByTestId('task-list')).toContainText('עד מחר');
  await page.reload();
  await expect(late).toHaveCount(0);
  await expect(page.getByTestId('task-list')).toContainText('עד מחר');
});

test('subtle mobile reschedule control remains reachable and only changes the displayed overdue tasks', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://localhost:3100', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await context.newPage();
  await page.clock.install({ time: wallTimeInstant(today(), '12:00')! });
  await register(page);
  const yesterday = formatFullDate(addDays(today(), -1));
  await add(page, `משימה דחופה ${yesterday} !1`, true);
  await add(page, `משימה רגילה ${yesterday} !3`, true);
  await page.getByRole('button', { name: 'תצוגת הרשימה', exact: true }).click();
  await page.getByLabel('סינון לפי עדיפות').selectOption('1');
  await page.getByRole('button', { name: 'הצגת המשימות', exact: true }).click();
  const late = page.locator('[data-task-group="overdue"]');
  const button = late.getByRole('button', { name: 'תזמון מחדש של המשימות שבאיחור' });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: '.local-artifacts/overdue-reschedule-mobile.png' });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local-artifacts/overdue-reschedule-mobile-dark.png' });
  await button.click();
  await expect(page.getByTestId('toasts')).toContainText('המשימה תוזמנה מחדש');
  await page.getByRole('button', { name: 'איפוס תצוגה', exact: true }).click();
  await expect(late).toContainText('משימה רגילה');
  await expect(late).not.toContainText('משימה דחופה');
  await expect(page.locator('[data-task-group="today"]')).toContainText('משימה דחופה');
  await page.reload();
  await expect(late).toContainText('משימה רגילה');
  await expect(late).not.toContainText('משימה דחופה');
  await context.close();
});

async function register(page: Page) {
  const email = `today-time-${Date.now()}-${Math.random().toString(16).slice(2)}@seder.test`;
  await page.goto(`${BASE_PATH}/register`);
  await page.getByLabel('שם', { exact: true }).fill('בדיקת היום — נתוני דוגמה');
  await page.getByLabel('אימייל', { exact: true }).fill(email);
  await page.getByLabel('סיסמה', { exact: true }).fill('today-time-test-123');
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/today');
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  return email;
}

test('one reschedule click gives each overdue task its own original relative destination', async ({ page }) => {
  const email = await register(page);
  await add(page, 'בדיקת א היום');
  await page.getByRole('button', { name: /^משימה חדשה/ }).click();
  const composer = page.getByTestId('task-composer');
  await composer.getByLabel('משימה חדשה', { exact: true }).fill('בדיקת ב');
  await composer.getByRole('button', { name: /^בחירת תאריך,/ }).click();
  await page.getByTestId('date-picker').getByRole('button', { name: /^מחר/ }).click();
  await composer.getByRole('button', { name: /^בחירת תאריך,/ }).click();
  await page.getByTestId('date-picker').getByRole('button', { name: 'הוספת שעה', exact: true }).click();
  await page.getByLabel('שעה', { exact: true }).fill('14:30');
  await page.getByRole('button', { name: 'שמור', exact: true }).click();
  await composer.getByRole('button', { name: 'הוספה', exact: true }).click();
  await expect(composer.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
  await composer.getByRole('button', { name: 'ביטול', exact: true }).click();
  await add(page, 'בדיקת ג שבוע הבא');
  // Selecting a preset in a task's existing date picker is remembered too.
  await add(page, 'בדיקת ד היום');
  await page.getByTestId('task-list').getByText('בדיקת ד', { exact: true }).click();
  await page.getByRole('group', { name: 'מתוזמן ל', exact: true }).getByRole('button', { name: 'היום', exact: true }).click();
  await page.getByTestId('date-picker').getByRole('button', { name: /^מחר/ }).click();
  await page.getByRole('button', { name: 'סגירה', exact: true }).click();
  const db = new PrismaClient();
  try {
    const tasks = await db.task.findMany({ where: { user: { email }, parentId: null } });
    expect(tasks.map(task => task.reschedulePreset).sort()).toEqual(['next-week', 'today', 'tomorrow', 'tomorrow']);
    // Simulate the passage of the originally selected days, keeping their
    // stored choices intact. The action itself uses the current server clock.
    await db.task.updateMany({ where: { user: { email } }, data: { scheduledFor: addDays(today(), -2), scheduledTime: '09:00', remindedAt: new Date() } });
    await page.reload();
    const late = page.locator('[data-task-group="overdue"]');
    await expect(late.locator('.task-row')).toHaveCount(4);
    await late.getByRole('button', { name: 'תזמון מחדש של המשימות שבאיחור' }).click();
    await expect(page.getByTestId('toasts')).toContainText('4 משימות תוזמנו מחדש');
    const stored = await db.task.findMany({ where: { user: { email } } });
    for (const task of stored) {
      expect(task.scheduledFor?.toISOString()).toBe(rescheduleDate(task.reschedulePreset).toISOString());
      expect(task.scheduledTime).toBeNull();
      expect(task.remindedAt).toBeNull();
    }
    await page.reload();
    await expect(page.getByTestId('task-list')).toContainText('בדיקת א');
    await expect(page.getByTestId('task-list')).not.toContainText('בדיקת ב');
    await expect(late).toHaveCount(0);
    await page.getByRole('link', { name: /^בקרוב/ }).click();
    await expect(page.getByTestId('task-list')).toContainText('בדיקת ב');
    await expect(page.getByTestId('task-list')).toContainText('בדיקת ג');
    await expect(page.getByTestId('task-list')).toContainText('בדיקת ד');
  } finally { await db.$disconnect(); }
});

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
