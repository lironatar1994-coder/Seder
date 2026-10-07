import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { BASE_PATH } from '../playwright.config';
import { today, addDays } from '../src/lib/dates';
const db = new PrismaClient();
const at = (path: string) => `${BASE_PATH}${path}`;
async function register(page: Page) {
  const email = `google-calendar-${Date.now()}-${Math.random().toString(16).slice(2)}@seder.test`;
  await page.goto(at('/register')); await page.getByLabel('שם', { exact: true }).fill('בודק יומן'); await page.getByLabel('אימייל', { exact: true }).fill(email); await page.getByLabel('סיסמה', { exact: true }).fill('calendar-test-123'); await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click(); await page.waitForURL('**/app/**'); await expect(page.getByTestId('whatsapp-introduction')).toBeVisible(); await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click(); return email;
}
test.afterAll(async () => db.$disconnect());
test('calendar connection is concise and exposes no Google write-back controls', async ({ page }) => {
  await register(page); await page.goto(at('/app/settings/calendar'));
  await expect(page.getByRole('button', { name: 'חיבור יומן Google', exact: true })).toBeDisabled();
  await expect(page.getByText('אירועי Google מופיעים אוטומטית בסדר. לקריאה בלבד.', { exact: true })).toBeVisible();
  await expect(page.getByText('סנכרון משימות ל־Google', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'יצירת קישור מנוי', exact: true })).toHaveCount(0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local-artifacts/google-calendar/readonly-${width}.png`, fullPage: true, animations: 'disabled' });
  }
});
test('cached Google events appear alongside tasks across desktop and mobile, without leaking to other accounts', async ({ page, browser }) => {
  const email = await register(page); const user = await db.user.findUniqueOrThrow({ where: { email } }); const start = today(); const end = addDays(start, 1);
  const connection = await db.googleCalendarConnection.create({ data: { userId: user.id, accountEmail: 'test-google@gmail.com', refreshToken: 'test-only', accessToken: 'test-only', accessExpiresAt: end, sources: { create: { googleId: 'fake-primary', name: 'יומן בדיקה', enabled: true, events: { create: { googleId: 'fake-meeting', title: 'פגישה מיומן Google', allDay: true, startAt: start, endAt: end, startDay: start.toISOString().slice(0, 10), endDay: start.toISOString().slice(0, 10), htmlLink: 'https://calendar.google.com/calendar/event?eid=fake' } } } } } });
  await page.goto(at('/app/today')); await expect(page.getByTestId('google-event')).toContainText('פגישה מיומן Google');
  await page.goto(at('/app/calendar')); await expect(page.getByTestId('google-event').first()).toContainText('פגישה מיומן Google'); expect(await page.getByTestId('google-event').first().getAttribute('aria-roledescription')).toBeNull();
  for (const width of [390, 320]) { await page.setViewportSize({ width, height: 844 }); await expect(page.getByTestId('google-event').filter({ visible: true }).first()).toContainText('פגישה מיומן Google'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  const outsider = await browser.newPage(); await register(outsider); await outsider.goto(at('/app/today')); await expect(outsider.getByTestId('google-event')).toHaveCount(0); await outsider.close();
  await page.goto(at('/app/settings/calendar')); await expect(page.getByText('test-google@gmail.com', { exact: true })).toBeVisible();
  await expect(page.getByLabel('הצגת אירועי Google בסדר')).toBeHidden();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local-artifacts/google-calendar/connected-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.locator('summary').filter({ hasText: 'העדפות סנכרון' }).click();
  await expect(page.getByLabel('הצגת אירועי Google בסדר')).toBeChecked();
  await page.getByRole('button', { name: 'ניתוק', exact: true }).click(); await page.getByRole('button', { name: 'אישור ניתוק', exact: true }).click(); await expect(page.getByText('חשבון מחובר', { exact: true })).toHaveCount(0); expect(await db.googleCalendarConnection.findUnique({ where: { id: connection.id } })).toBeNull(); expect(await db.googleCalendarEvent.count({ where: { source: { connectionId: connection.id } } })).toBe(0);
});

