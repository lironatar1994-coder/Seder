import { test, expect, type Page } from '@playwright/test';
import { BASE_PATH } from '../playwright.config';

async function register(page: Page) {
  await page.goto(`${BASE_PATH}/register?next=%2Fapp%2Ftoday`);
  await page.getByLabel('שם', { exact: true }).fill('בדיקת חוויית שימוש');
  await page.getByLabel('אימייל', { exact: true }).fill(`interaction-${Date.now()}-${Math.random()}@seder.test`);
  await page.getByLabel('סיסמה', { exact: true }).fill('interaction-test-123');
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/today');
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
}
async function add(page: Page, text: string) {
  await page.getByRole('button', { name: /^משימה חדשה/ }).click();
  await page.getByLabel('משימה חדשה', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'הוספה', exact: true }).click();
  await expect(page.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
  await expect(page.getByTestId('toasts').locator('[data-toast-tone="success"]').last()).toContainText('נוספה');
  await page.getByTestId('task-composer').getByRole('button', { name: 'ביטול', exact: true }).click();
}
test('settings has a mobile directory, clear location, return to the original view and working history', async ({ page }) => {
  await register(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('navigation', { name: 'ניווט מהיר' }).getByRole('link', { name: 'תיבה', exact: true }).click();
  await page.waitForURL('**/app/inbox');
  await page.getByRole('button', { name: 'רשימות', exact: true }).click();
  await page.getByRole('link', { name: 'הגדרות', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'הגדרות', level: 1, exact: true })).toBeVisible();
  await expect(page.getByTestId('settings-overview').getByRole('link')).toHaveCount(7);
  await expect(page.locator('.mobile-add')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'ניווט מהיר' })).toBeHidden();
  await expect.poll(() => page.locator('.rail').evaluate(node => getComputedStyle(node).visibility)).toBe('hidden');
  await page.screenshot({ path: '.local-artifacts/settings-overview-mobile.png' });
  await page.getByTestId('settings-overview').getByRole('link', { name: 'מראה', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'מראה', level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'כל ההגדרות', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'חזרה למשימות', exact: true })).toHaveAttribute('href', `${BASE_PATH}/app/inbox`);
  await page.screenshot({ path: '.local-artifacts/settings-section-mobile.png' });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local-artifacts/settings-section-mobile-dark.png' });
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () => (await page.locator('.rail').boundingBox())?.width).toBe(width >= 1024 ? 280 : 256);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local-artifacts/settings-section-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await expect(page.getByRole('navigation', { name: 'מקטעי הגדרות' }).getByRole('link', { name: 'מראה', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect.poll(async () => (await page.locator('.rail').boundingBox())?.width).toBe(280);
  await page.locator('.rail-nav').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: '.local-artifacts/settings-section-desktop.png' });
  await page.goBack(); await expect(page.getByTestId('settings-overview')).toBeVisible();
  await page.goForward(); await expect(page.getByRole('heading', { name: 'מראה', level: 1, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'חזרה למשימות', exact: true })).toHaveAttribute('href', `${BASE_PATH}/app/inbox`);
  await page.getByRole('link', { name: 'חזרה למשימות', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'תיבה נכנסת', level: 1, exact: true })).toBeVisible();
  await page.goBack(); await expect(page.getByRole('heading', { name: 'מראה', level: 1, exact: true })).toBeVisible();
});

test('creation and edits get blue confirmations; completion plays once and the mute setting persists', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__soundStarts = 0;
    (window as any).__soundCues = 0;
    window.addEventListener('seder:completion-sound', () => (window as any).__soundCues++);
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const node = create.call(this);
      const start = node.start.bind(node);
      node.start = (...args) => { (window as any).__soundStarts++; start(...args); };
      return node;
    };
  });
  await register(page);
  await page.evaluate(() => { document.documentElement.dataset.accent = 'green'; });
  await add(page, 'בדיקת צליל היום');
  expect(await page.evaluate(() => (window as any).__soundStarts)).toBe(0);
  await page.getByTestId('task-list').getByText('בדיקת צליל', { exact: true }).click();
  await page.getByLabel('שם המשימה').fill('בדיקת צליל מעודכנת');
  await page.getByLabel('שם המשימה').press('Tab');
  const saved = page.getByTestId('toasts').locator('[data-toast-tone="success"]').filter({ hasText: 'השינויים נשמרו' });
  await expect(saved).toBeVisible();
  const channels = await saved.locator('svg').first().evaluate(node => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const paint = canvas.getContext('2d')!;
    paint.fillStyle = getComputedStyle(node).color;
    paint.fillRect(0, 0, 1, 1);
    return [...paint.getImageData(0, 0, 1, 1).data];
  });
  expect(channels[2]).toBeGreaterThan(channels[1]);
  expect(channels[2]).toBeGreaterThan(channels[0]);
  await page.getByRole('button', { name: 'סגירה', exact: true }).click();
  await page.getByRole('checkbox', { name: 'סימון כהושלם: בדיקת צליל מעודכנת', exact: true }).click();
  await expect(page.getByTestId('toasts')).toContainText('הושלם: בדיקת צליל מעודכנת');
  await expect.poll(() => page.evaluate(() => (window as any).__soundCues)).toBe(1);
  expect(await page.evaluate(() => (window as any).__soundStarts)).toBeGreaterThan(0);
  await add(page, 'בדיקת השתקה היום');
  await page.getByRole('link', { name: 'הגדרות', exact: true }).click();
  await page.getByTestId('settings-overview').getByRole('link', { name: 'מראה', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'צליל השלמה', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('link', { name: 'חזרה למשימות', exact: true }).click();
  await page.getByRole('checkbox', { name: 'סימון כהושלם: בדיקת השתקה', exact: true }).click();
  await expect(page.getByTestId('toasts')).toContainText('הושלם: בדיקת השתקה');
  expect(await page.evaluate(() => (window as any).__soundStarts)).toBe(0);
});

test('a failed creation shows an error and keeps the entered task without playing completion audio', async ({ page }) => {
  await register(page);
  await page.route('**/app/today*', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.getByRole('button', { name: /^משימה חדשה/ }).click();
  await page.getByLabel('משימה חדשה', { exact: true }).fill('משימה שלא נשמרה');
  await page.getByRole('button', { name: 'הוספה', exact: true }).click();
  await expect(page.getByTestId('toasts').locator('[data-toast-tone="error"]')).toContainText('המשימה לא נשמרה');
  await expect(page.getByLabel('משימה חדשה', { exact: true })).toHaveValue('משימה שלא נשמרה');
  await expect(page.getByTestId('toasts').locator('[data-toast-tone="success"]')).toHaveCount(0);
});


test('completion and its undo survive leaving the view during the row animation', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__soundCues = 0;
    window.addEventListener('seder:completion-sound', () => (window as any).__soundCues++);
  });
  await register(page);
  await add(page, 'פעולה שנשמרת היום');
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.getByRole('checkbox', { name: 'סימון כהושלם: פעולה שנשמרת', exact: true }).click();
  await page.locator(`.rail a[href="${BASE_PATH}/app/inbox"]`).click();
  await expect(page.getByRole('heading', { name: 'תיבה נכנסת', exact: true, level: 1 })).toBeVisible();
  await page.clock.runFor(450);
  await expect(page.getByTestId('toasts')).toContainText('הושלם: פעולה שנשמרת');
  await expect(page.getByTestId('task-list').getByText('פעולה שנשמרת', { exact: true })).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as any).__soundCues)).toBe(1);
  await page.getByTestId('toasts').getByRole('button', { name: 'ביטול', exact: true }).click();
  await expect(page.getByTestId('task-list').getByText('פעולה שנשמרת', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__soundCues)).toBe(1);
  await page.reload();
  await expect(page.getByTestId('task-list').getByText('פעולה שנשמרת', { exact: true })).toBeVisible();
});
