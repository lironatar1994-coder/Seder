import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { BASE_PATH } from '../playwright.config';
const db = new PrismaClient();
const at = (path: string) => `${BASE_PATH}${path}`;
const password = 'whatsapp-test-123';
const made: string[] = [];
async function register(page: Page) {
  const email = `whatsapp-intro-${Date.now()}-${Math.random().toString(16).slice(2)}@seder.test`;
  await page.goto(at('/register'));
  await page.getByLabel('שם', { exact: true }).fill('בודק וואטסאפ');
  await page.getByLabel('אימייל', { exact: true }).fill(email);
  await page.getByLabel('סיסמה', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/**'); made.push(email); return email;
}
test.afterAll(async () => { await db.user.deleteMany({ where: { email: { in: made } } }); await db.$disconnect(); });

test('visual WhatsApp introduction fits phone screens and leads to explicit opt-in settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = await register(page);
  const popup = page.getByTestId('whatsapp-introduction');
  await expect(popup).toBeVisible();
  const image = popup.getByRole('img'); await expect(image).toBeVisible();
  await expect.poll(async () => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(popup.getByRole('link', { name: 'להגדרות וואטסאפ' })).toBeInViewport();
  }
  await popup.getByRole('link', { name: 'להגדרות וואטסאפ' }).click();
  await page.waitForURL('**/settings/whatsapp');
  await expect(page.getByRole('switch', { name: 'קבלת תזכורות', exact: true })).not.toBeChecked();
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.whatsappReminders).toBe(false); expect(user.phone).toBeNull();
  await expect(page.getByRole('button', { name: 'חיבור מחדש', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'שליחת תזכורת בדיקה', exact: true })).toHaveCount(0);
});

test('dismissal persists across reloads and another device without enabling messages', async ({ page, browser }) => {
  const email = await register(page);
  const popup = page.getByTestId('whatsapp-introduction'); await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { email } })).whatsappIntroSeenAt).not.toBeNull();
  await page.reload(); await page.waitForTimeout(1600); await expect(popup).toHaveCount(0);
  const context = await browser.newContext(); const other = await context.newPage();
  await other.goto(at('/login')); await other.getByLabel('אימייל', { exact: true }).fill(email); await other.getByLabel('סיסמה', { exact: true }).fill(password); await other.getByRole('button', { name: 'כניסה', exact: true }).click();
  await other.waitForURL('**/app/**'); await other.waitForTimeout(1600); await expect(other.getByTestId('whatsapp-introduction')).toHaveCount(0);
  expect((await db.user.findUniqueOrThrow({ where: { email } })).whatsappReminders).toBe(false);
  await context.close();
});

test('connected reminder users are not prompted and settings remain available', async ({ page }) => {
  const email = await register(page);
  await page.goto(at('/app/settings/whatsapp'));
  await db.user.update({ where: { email }, data: { phone: `05${String(Date.now()).slice(-8)}`, whatsappReminders: true, whatsappIntroSeenAt: null } });
  await page.goto(at('/app/today')); await page.waitForTimeout(1600); await expect(page.getByTestId('whatsapp-introduction')).toHaveCount(0);
  await page.goto(at('/app/settings/whatsapp'));
  await expect(page.getByRole('switch', { name: 'קבלת תזכורות', exact: true })).toBeChecked();
});
