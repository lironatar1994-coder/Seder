import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { readFileSync } from 'node:fs';
import { BASE_PATH, MAIL_LOG } from '../playwright.config';

const db = new PrismaClient();
const email = `admin-e2e-${Date.now()}@seder.test`;
const password = 'test-admin-strong-1234';
const at = (path: string) => `${BASE_PATH}${path}`;

test.beforeAll(async () => {
  await db.user.create({ data: { email, name: 'מנהל בדיקה', role: 'admin', passwordHash: await hash(password) } });
});
test.afterAll(async () => { await db.user.deleteMany({ where: { email } }); await db.$disconnect(); });

test('dedicated admin signs in to its dashboard, searches, and cannot enter the personal workspace', async ({ page }) => {
  await page.goto(at('/login'));
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'כניסה', exact: true }).click();
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: 'ניהול', exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.getByRole('searchbox').fill('no-such-account-unique');
  await expect(page.getByText('לא נמצאו משתמשים לחיפוש הזה')).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page.goto(at('/app/today'));
  await page.waitForURL('**/admin');
  await page.setViewportSize({ width: 320, height: 780 });
  await page.getByRole('button', { name: 'יציאה', exact: true }).click();
  await page.waitForURL('**/login');
});

test('ordinary registration cannot promote itself or read admin data', async ({ page }) => {
  const ordinary = `ordinary-admin-e2e-${Date.now()}@seder.test`;
  try {
    await page.goto(at('/register'));
    await page.getByLabel('שם', { exact: true }).fill('חשבון רגיל');
    await page.getByLabel('אימייל').fill(ordinary);
    await page.getByLabel('סיסמה', { exact: true }).fill(password);
    await page.locator('form').evaluate((form) => { const role = document.createElement('input'); role.name = 'role'; role.value = 'admin'; form.appendChild(role); });
    await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
    await page.waitForURL('**/app/today');
    expect((await db.user.findUnique({ where: { email: ordinary }, select: { role: true } }))?.role).toBe('user');
    const response = await page.goto(at('/admin'));
    expect(response?.status()).toBe(404);
    await expect(page.locator('[data-admin-shell]')).toHaveCount(0);
  } finally { await db.user.deleteMany({ where: { email: ordinary } }); }
});

test('anonymous and forged-cookie visits are sent to sign-in', async ({ page, context }) => {
  await page.goto(at('/admin'));
  await page.waitForURL('**/login?next=*');
  await context.addCookies([{ name: 'seder_session', value: 'forged-token', domain: 'localhost', path: '/' }]);
  await page.goto(at('/admin'));
  await page.waitForURL('**/login?next=*');
  await expect(page.locator('[data-admin-shell]')).toHaveCount(0);
});

test('administrator sends a recovery link on mobile and the recipient alone completes the reset', async ({ page, browser }) => {
  const recipientEmail = `admin-reset-recipient-${Date.now()}@seder.test`;
  const originalPassword = 'original-user-password-1234';
  const nextPassword = 'recipient-new-password-5678';
  const recipient = await db.user.create({ data: { email: recipientEmail, name: 'משתמש לאיפוס', passwordHash: await hash(originalPassword) } });
  try {
    await db.session.create({ data: { userId: recipient.id, tokenHash: `reset-session-${Date.now()}`, expiresAt: new Date(Date.now() + 86_400_000) } });
    await page.goto(at('/login'));
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'כניסה', exact: true }).click();
    await page.waitForURL('**/admin');
    await page.setViewportSize({ width: 320, height: 780 });
    await page.getByRole('searchbox').fill(recipientEmail);
    const reset = page.getByRole('button', { name: `שליחת קישור לאיפוס סיסמה אל ${recipientEmail}`, exact: true });
    await expect(reset).toBeVisible();
    await reset.click();
    await expect(page.getByRole('status').getByText('נוצרה תצוגת בדיקה. מייל לא נשלח')).toBeVisible();
    await expect(reset).toBeDisabled();
    expect(await db.session.count({ where: { userId: recipient.id } })).toBe(1);
    const mail = readFileSync(MAIL_LOG, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((item) => item.to === recipientEmail).at(-1);
    const link = mail.text.match(/https?:\/\/[^\s]+\/reset\/[A-Za-z0-9_-]+/)[0];
    const context = await browser.newContext();
    const recipientPage = await context.newPage();
    await recipientPage.goto(link);
    await recipientPage.getByLabel('סיסמה חדשה', { exact: true }).fill(nextPassword);
    await recipientPage.getByLabel('שוב, לוודא').fill(nextPassword);
    await recipientPage.getByRole('button', { name: 'שמירת סיסמה חדשה' }).click();
    await expect(recipientPage).toHaveURL(/\/login\?reset=1/);
    expect(await db.session.count({ where: { userId: recipient.id } })).toBe(0);
    await recipientPage.getByLabel('אימייל').fill(recipientEmail);
    await recipientPage.getByLabel('סיסמה', { exact: true }).fill(nextPassword);
    await recipientPage.getByRole('button', { name: 'כניסה', exact: true }).click();
    await recipientPage.waitForURL('**/app/today');
    await context.close();
  } finally { await db.user.deleteMany({ where: { id: recipient.id } }); }
});
