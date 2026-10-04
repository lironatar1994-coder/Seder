import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { BASE_PATH } from '../playwright.config';
import { today, addDays } from '../src/lib/dates';
const db = new PrismaClient();
const at = (path: string) => `${BASE_PATH}${path}`;
async function register(page: Page) {
  const email = `google-calendar-${Date.now()}-${Math.random().toString(16).slice(2)}@seder.test`;
  await page.goto(at('/register')); await page.getByLabel('שם', { exact: true }).fill('בודק יומן'); await page.getByLabel('אימייל', { exact: true }).fill(email); await page.getByLabel('סיסמה', { exact: true }).fill('calendar-test-123'); await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click(); await page.waitForURL('**/app/**'); return email;
}
test.afterAll(async () => db.$disconnect());
test('calendar subscription reads scheduled work, isolates users and supports immediate revocation', async ({ page, browser }) => {
  const email = await register(page); const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.task.create({ data: { userId: user.id, title: 'משימה פרטית ליומן', whenBucket: 'SCHEDULED', scheduledFor: today(), scheduledTime: '09:30', durationMinutes: 60, position: 'a0' } });
  await page.goto(at('/app/settings/calendar')); await page.getByRole('button', { name: 'יצירת קישור מנוי', exact: true }).click(); const url = await page.getByLabel('קישור המנוי שלכם').inputValue();
  const response = await page.request.get(url); expect(response.status()).toBe(200); expect(response.headers()['content-type']).toContain('text/calendar'); expect(await response.text()).toContain('SUMMARY:משימה פרטית ליומן');
  const outsider = await browser.newPage(); await register(outsider); await outsider.goto(at('/app/settings/calendar')); await outsider.getByRole('button', { name: 'יצירת קישור מנוי', exact: true }).click(); const otherUrl = await outsider.getByLabel('קישור המנוי שלכם').inputValue(); expect(await (await outsider.request.get(otherUrl)).text()).not.toContain('משימה פרטית ליומן'); await outsider.close();
  await page.getByRole('button', { name: 'יצירת קישור חדש', exact: true }).click(); await expect(page.getByLabel('קישור המנוי שלכם')).not.toHaveValue(url); expect((await page.request.get(url)).status()).toBe(404); const newUrl = await page.getByLabel('קישור המנוי שלכם').inputValue(); await page.getByRole('button', { name: 'ביטול קישור המנוי', exact: true }).click(); await expect(page.getByLabel('קישור המנוי שלכם')).toHaveCount(0); expect((await page.request.get(newUrl)).status()).toBe(404); await page.reload(); await expect(page.getByLabel('קישור המנוי שלכם')).toHaveCount(0);
});
test('cached Google events appear alongside tasks across desktop and mobile, without leaking to other accounts', async ({ page, browser }) => {
  const email = await register(page); const user = await db.user.findUniqueOrThrow({ where: { email } }); const start = today(); const end = addDays(start, 1);
  const connection = await db.googleCalendarConnection.create({ data: { userId: user.id, accountEmail: 'test-google@gmail.com', refreshToken: 'test-only', accessToken: 'test-only', accessExpiresAt: end, sources: { create: { googleId: 'fake-primary', name: 'יומן בדיקה', enabled: true, events: { create: { googleId: 'fake-meeting', title: 'פגישה מיומן Google', allDay: true, startAt: start, endAt: end, startDay: start.toISOString().slice(0, 10), endDay: start.toISOString().slice(0, 10), htmlLink: 'https://calendar.google.com/calendar/event?eid=fake' } } } } } });
  await page.goto(at('/app/today')); await expect(page.getByTestId('google-event')).toContainText('פגישה מיומן Google');
  await page.goto(at('/app/calendar')); await expect(page.getByTestId('google-event').first()).toContainText('פגישה מיומן Google'); expect(await page.getByTestId('google-event').first().getAttribute('aria-roledescription')).toBeNull();
  for (const width of [390, 320]) { await page.setViewportSize({ width, height: 844 }); await expect(page.getByTestId('google-event').filter({ visible: true }).first()).toContainText('פגישה מיומן Google'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  const outsider = await browser.newPage(); await register(outsider); await outsider.goto(at('/app/today')); await expect(outsider.getByTestId('google-event')).toHaveCount(0); await outsider.close();
  await page.goto(at('/app/settings/calendar')); await expect(page.getByText('test-google@gmail.com', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'ניתוק', exact: true }).click(); await page.getByRole('button', { name: 'אישור ניתוק', exact: true }).click(); await expect(page.getByText('חשבון מחובר', { exact: true })).toHaveCount(0); expect(await db.googleCalendarConnection.findUnique({ where: { id: connection.id } })).toBeNull(); expect(await db.googleCalendarEvent.count({ where: { source: { connectionId: connection.id } } })).toBe(0);
});

