import { test, expect, type Page } from '@playwright/test';
import { BASE_PATH } from '../playwright.config';

async function register(page: Page) {
  await page.goto(`${BASE_PATH}/register?next=${encodeURIComponent('/app/today')}`);
  await page.getByLabel('שם', { exact: true }).fill('בדיקת ניווט');
  await page.getByLabel('אימייל', { exact: true }).fill(`navigation-${Date.now()}-${Math.random()}@seder.test`);
  await page.getByLabel('סיסמה', { exact: true }).fill('navigation-test-123');
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/today');
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
}

async function add(page: Page, title: string) {
  await page.getByRole('button', { name: /^משימה חדשה/ }).click();
  await page.getByLabel('משימה חדשה', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'הוספה', exact: true }).click();
  await expect(page.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'ביטול', exact: true }).click();
}

test('Back and Forward retrace task steps, dismissal, reload, and a new branch', async ({ page }) => {
  await register(page);
  await add(page, 'משימת ניווט א היום');
  await add(page, 'משימת ניווט ב היום');
  await page.getByTestId('task-list').getByText('משימת ניווט א', { exact: true }).click();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת ניווט א');
  const first = page.url();
  await page.getByRole('button', { name: 'המשימה הקודמת', exact: true }).click();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת ניווט ב');
  await page.goBack();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת ניווט א');
  await page.goForward();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת ניווט ב');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('שם המשימה')).toBeHidden();
  await page.goBack();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת ניווט ב');
  await page.reload();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת ניווט ב');
  await page.goBack();
  await expect(page).toHaveURL(first);
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת ניווט א');
  await page.keyboard.press('Escape');
  // New navigation after Back discards the previous forward branch.
  const branch = page.url();
  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(branch);
  await expect(page.getByLabel('שם המשימה')).toBeHidden();
});

test('list filters and search restore with one step per search session', async ({ page }) => {
  await register(page);
  await add(page, 'משימה דחופה היום !1');
  await add(page, 'משימה רגילה היום !3');
  await page.getByRole('button', { name: 'תצוגת הרשימה', exact: true }).click();
  await page.getByLabel('סינון לפי עדיפות').selectOption('1');
  await page.getByLabel('מיון משימות').selectOption('title');
  await page.getByLabel('חיפוש ברשימה').pressSequentially('דחופה');
  await page.goBack();
  await expect(page.getByLabel('חיפוש ברשימה')).toHaveValue('');
  await expect(page.getByLabel('מיון משימות')).toHaveValue('title');
  await page.goBack();
  await expect(page.getByLabel('מיון משימות')).toHaveValue('manual');
  await page.goBack();
  await expect(page.getByLabel('סינון לפי עדיפות')).toHaveValue('all');
  await expect(page.getByTestId('task-list')).toContainText('משימה רגילה');
  await page.goForward();
  await expect(page.getByLabel('סינון לפי עדיפות')).toHaveValue('1');
  await page.reload();
  await expect(page.getByTestId('task-list').getByText('משימה רגילה', { exact: true })).toBeHidden();
});

test('search task detail can be retraced without reviving an old search', async ({ page }) => {
  await register(page);
  await add(page, 'משימה דרך חיפוש היום');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('חיפוש משימה, או מעבר לתצוגה…').fill('דרך חיפוש');
  await page.getByTestId('palette-list').getByText('משימה דרך חיפוש', { exact: true }).click();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימה דרך חיפוש');
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goForward();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימה דרך חיפוש');
  await page.reload();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימה דרך חיפוש');
});

test('calendar day panel and period changes retrace on desktop', async ({ page }) => {
  await register(page);
  await page.getByRole('link', { name: 'לוח שנה', exact: true }).click();
  // The grid's day buttons have their full date as an accessible name.
  await page.getByRole('button', { name: /פריטים$/ }).first().click();
  await expect(page).toHaveURL(/dayPanel=/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: '.local-artifacts/navigation-desktop.png' });
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goForward();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'לתקופה הבאה' }).click();
  await expect(page).toHaveURL(/\?m=/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\?m=/);
});

test('mobile task and calendar day history work inside the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  await page.locator('.mobile-add').click();
  await page.getByLabel('משימה חדשה', { exact: true }).fill('משימת טלפון היום');
  await page.getByRole('button', { name: 'הוספה', exact: true }).click();
  await expect(page.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'סגירת המשימה החדשה', exact: true }).click();
  await page.getByTestId('task-list').getByText('משימת טלפון', { exact: true }).click();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת טלפון');
  await page.goBack();
  await expect(page.getByLabel('שם המשימה')).toBeHidden();
  await page.goForward();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת טלפון');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'תפריט', exact: true }).click();
  await page.getByRole('link', { name: 'לוח שנה', exact: true }).click();
  const days = page.locator('[data-strip-day]');
  await days.nth(5).click();
  const selected = page.url();
  await days.nth(6).click();
  await page.goBack();
  await expect(page).toHaveURL(selected);
  await expect(days.nth(5)).toHaveAttribute('aria-current', 'date');
  await page.screenshot({ path: '.local-artifacts/navigation-mobile.png' });
});

test('project list and board selection share history with task detail', async ({ page }) => {
  await register(page);
  await page.getByRole('link', { name: 'עבודה', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'עבודה', level: 1, exact: true })).toBeVisible();
  await add(page, 'משימת לוח');
  await page.getByRole('button', { name: 'לוח', exact: true }).click();
  await expect(page.getByTestId('project-board')).toBeVisible();
  await page.getByTestId('board-card').getByText('משימת לוח', { exact: true }).click();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת לוח');
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goBack();
  await expect(page.getByTestId('task-list')).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('project-board')).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת לוח');
  await page.reload();
  await expect(page.getByTestId('project-board')).toBeVisible();
  await expect(page.getByLabel('שם המשימה')).toHaveValue('משימת לוח');
});

test('history links cannot expose another account’s task', async ({ page, browser }) => {
  await register(page);
  await add(page, 'משימה פרטית היום');
  await page.getByTestId('task-list').getByText('משימה פרטית', { exact: true }).click();
  const url = page.url();
  const other = await browser.newContext();
  const stranger = await other.newPage();
  await register(stranger);
  await stranger.goto(url);
  await expect(stranger.getByTestId('toasts')).toContainText('המשימה אינה זמינה יותר');
  await expect(stranger.getByLabel('שם המשימה')).toBeHidden();
  await expect(stranger.getByText('משימה פרטית', { exact: true })).toBeHidden();
  await other.close();
});

test('returning to a view restores the workspace scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await register(page);
  for (let i = 0; i < 12; i++) await add(page, `משימת גלילה ${i} היום`);
  await page.locator('main').evaluate((main) => { main.scrollTop = 260; });
  await expect.poll(() => page.locator('main').evaluate((main) => main.scrollTop)).toBe(260);
  await page.getByRole('link', { name: 'בקרוב', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/upcoming$/);
  await page.goBack();
  await expect(page.getByTestId('task-list')).toContainText('משימת גלילה 11');
  await expect.poll(() => page.locator('main').evaluate((main) => main.scrollTop)).toBe(260);
});
