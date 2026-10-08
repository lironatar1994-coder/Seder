import { test, expect, type Page } from '@playwright/test';
import { BASE_PATH } from '../playwright.config';
const at = (path: string) => `${BASE_PATH}${path}`;
async function register(page: Page, next?: string) {
  const email = `workspace-${Date.now()}-${Math.random().toString(16).slice(2)}@seder.test`;
  await page.goto(at(`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`));
  await page.getByLabel('שם', { exact: true }).fill('בודק מרחב');
  await page.getByLabel('אימייל', { exact: true }).fill(email);
  await page.getByLabel('סיסמה', { exact: true }).fill('workspace-test-123');
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/**');
  await expect(page.getByTestId('whatsapp-introduction')).toBeVisible();
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  return email;
}
async function add(page: Page, text: string) {
  await page.getByRole('button', { name: /^משימה חדשה/ }).click();
  await page.getByLabel('משימה חדשה', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'הוספה', exact: true }).click();
  await expect(page.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'ביטול', exact: true }).click();
}

test('list search, priority filters, sorting, and focus timer work', async ({ page }) => {
  await register(page); await add(page, 'להגיש הצעה היום !1'); await add(page, 'לקרוא מסמך היום !3');
  await page.getByRole('button', { name: 'תצוגת הרשימה', exact: true }).click();
  await page.getByLabel('חיפוש ברשימה').fill('מסמך');
  await expect(page.getByTestId('task-list').getByText('לקרוא מסמך', { exact: true })).toBeVisible();
  await expect(page.getByTestId('task-list').getByText('להגיש הצעה', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'ניקוי חיפוש' }).click();
  await page.getByLabel('סינון לפי עדיפות').selectOption('1');
  await expect(page.getByTestId('task-list').getByText('להגיש הצעה', { exact: true })).toBeVisible();
  await expect(page.getByTestId('task-list').getByText('לקרוא מסמך', { exact: true })).toBeHidden();
  await page.getByLabel('סינון לפי עדיפות').selectOption('all');
  await page.getByLabel('מיון משימות').selectOption('title');
  await page.getByLabel('חיפוש ברשימה').fill('הצעה');
  await page.getByLabel('סינון לפי עדיפות').selectOption('1');
  await page.getByRole('button', { name: 'הצגת המשימות', exact: true }).click();
  await expect(page.getByRole('button', { name: 'חיפוש: הצעה · עדיפות: דחוף · מיון: שם', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'איפוס תצוגה', exact: true }).click();
  await expect(page.getByTestId('task-list').getByText('לקרוא מסמך', { exact: true })).toBeVisible();
  await page.goto(at('/app/focus'));
  await page.getByRole('button', { name: 'התחלת מיקוד' }).click();
  await expect(page.getByRole('button', { name: 'השהיה' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'השהיה' })).toBeVisible();
  await page.getByRole('button', { name: 'השהיה' }).click();
  await page.getByRole('button', { name: 'איפוס זמן המיקוד' }).click();
  await expect(page.getByText('25:00', { exact: true })).toBeVisible();
});

test('project templates, board moves, section renaming, and comments persist', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: 'פרויקט חדש', exact: true }).click();
  await page.getByRole('dialog').getByLabel('שם', { exact: true }).fill('תהליך משותף');
  await page.getByLabel('נקודת התחלה').selectOption('workflow');
  await page.getByRole('button', { name: 'יצירת פרויקט' }).click();
  await page.waitForURL('**/app/project/**');
  await add(page, 'להכין תוכנית');
  await page.getByRole('button', { name: 'לוח', exact: true }).click();
  const card = page.getByTestId('board-card').filter({ hasText: 'להכין תוכנית' });
  await page.getByLabel('העברת להכין תוכנית לקטע').selectOption({ label: 'בביצוע' });
  await expect(page.locator('.board-column').filter({ has: page.getByRole('heading', { name: 'בביצוע', exact: true }) }).getByTestId('board-card')).toContainText('להכין תוכנית');
  await page.reload(); await expect(page.getByTestId('project-board')).toBeVisible();
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'שינוי שם בביצוע' }).click();
  await page.getByLabel('שם הקטע', { exact: true }).fill('בתהליך');
  await page.getByRole('button', { name: 'שמירת שם הקטע' }).click();
  await expect(page.getByRole('heading', { name: 'בתהליך', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'להכין תוכנית', exact: true }).click();
  await page.getByLabel('תגובה חדשה').fill('התכנון מוכן לבדיקה');
  await page.getByRole('button', { name: 'הוספת תגובה' }).click();
  await expect(page.getByTestId('task-comments').getByText('התכנון מוכן לבדיקה', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'סגירה', exact: true }).click();
  await page.reload(); await card.getByRole('button', { name: 'להכין תוכנית', exact: true }).click();
  await expect(page.getByTestId('task-comments').getByText('התכנון מוכן לבדיקה', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'מחיקת התגובה' }).click();
  await expect(page.getByTestId('task-comments').getByText('התכנון מוכן לבדיקה', { exact: true })).toBeHidden();
  await page.getByRole('dialog').getByRole('button', { name: 'סגירה', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(card).toBeInViewport();
});

test('saved filters persist and belong to their account', async ({ page, browser }) => {
  await register(page); await add(page, 'משימה דחופה היום !1'); await add(page, 'משימה רגילה היום !3');
  await page.goto(at('/app/filters'));
  await page.locator('select[name="priority"]').selectOption('1');
  await page.getByRole('button', { name: 'שמירת המסנן הזה' }).click();
  await page.getByLabel('שם המסנן').fill('הדחופים שלי');
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await page.waitForURL('**/filters?id=*'); const savedUrl = page.url();
  await page.reload(); await expect(page.getByRole('heading', { name: 'הדחופים שלי', exact: true })).toBeVisible();
  await expect(page.getByTestId('task-list').getByText('משימה דחופה', { exact: true })).toBeVisible();
  await expect(page.getByTestId('task-list').getByText('משימה רגילה', { exact: true })).toBeHidden();
  const outsider = await browser.newContext(); const other = await outsider.newPage();
  await register(other); await other.goto(savedUrl);
  await expect(other.getByRole('heading', { name: 'הדחופים שלי', exact: true })).toBeHidden();
  await outsider.close();
});

test('a signed-out invitation survives login and account creation', async ({ page, browser }) => {
  await register(page); await page.getByRole('link', { name: 'עבודה', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'עבודה', level: 1, exact: true })).toBeVisible();
  await add(page, 'משימה שנעבוד עליה ביחד');
  await page.getByRole('button', { name: 'שיתוף הפרויקט', exact: true }).click();
  await page.getByRole('button', { name: 'יצירת קישור', exact: true }).click();
  const invite = await page.getByRole('dialog').locator('code').innerText();
  const collaborator = await browser.newContext(); const friend = await collaborator.newPage();
  await friend.goto(invite); await expect(friend).toHaveURL(/\/login\?next=/);
  await friend.getByRole('link', { name: 'פתיחת חשבון', exact: true }).click();
  await friend.getByLabel('שם', { exact: true }).fill('חבר לפרויקט');
  await friend.getByLabel('אימייל', { exact: true }).fill(`friend-${Date.now()}@seder.test`);
  await friend.getByLabel('סיסמה', { exact: true }).fill('friend-password-123');
  await friend.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await friend.waitForURL('**/app/project/**');
  await expect(friend.getByTestId('task-list').getByText('משימה שנעבוד עליה ביחד', { exact: true })).toBeVisible();
  await collaborator.close();
});

test('email invitations restrict recipients and show preview delivery honestly', async ({ page, browser }) => {
  await register(page); await page.getByRole('link', { name: 'בית', exact: true }).click();
  await page.getByRole('button', { name: 'שיתוף הפרויקט', exact: true }).click();
  await page.getByLabel('הזמנה', { exact: true }).fill('intended-person@seder.test');
  await page.getByRole('button', { name: 'יצירת קישור', exact: true }).click();
  const invite = await page.getByRole('dialog').locator('code').innerText();
  await expect(page.getByTestId('toasts')).toContainText('האימייל לא נשלח');
  const outsider = await browser.newContext(); const other = await outsider.newPage();
  await register(other); await other.goto(invite);
  await expect(other.getByText('ההזמנה מיועדת לכתובת אימייל אחרת.', { exact: false })).toBeVisible();
  await outsider.close();
});

test('today, filters, projects and board stay inside a phone viewport in both themes', async ({ page }) => {
  await register(page); await add(page, 'משימה עם טקסט ארוך לבדיקת מסך קטן היום');
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((choice) => { localStorage.setItem('seder-theme', choice); document.documentElement.dataset.theme = choice; }, theme);
      for (const path of ['/app/today', '/app/filters', '/app/projects']) {
        await page.goto(at(path));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('mobile task-first layout keeps capture, Browse and display options reachable', async ({ page }) => {
  await register(page); await add(page, 'להכין מצגת היום בשעה 15:30'); await add(page, 'לעבור על התוכנית היום');
  for (const width of [320, 390, 576]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(at('/app/today'));
    await expect(page.getByRole('heading', { name: 'היום', exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.getByLabel('חיפוש ברשימה')).toHaveCount(0);
    const firstTask = await page.locator('[data-task-id]').first().boundingBox();
    expect(firstTask!.y).toBeLessThan(160);
    await expect(page.getByRole('button', { name: 'התחלת מיקוד' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'הוספת משימה', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'תפריט', exact: true }).click();
    await expect(page.getByRole('link', { name: 'מיקוד ותכנון', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'הגדרות', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'תפריט', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'תצוגת הרשימה', exact: true }).click();
    await page.getByLabel('חיפוש ברשימה').fill('מצגת');
    await page.getByRole('button', { name: 'הצגת המשימות', exact: true }).click();
    await expect(page.getByText('לעבור על התוכנית', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'איפוס תצוגה', exact: true }).click();
    await expect(page.getByText('לעבור על התוכנית', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(at('/app/settings/appearance'));
    await expect(page.getByRole('navigation', { name: 'ניווט מהיר', exact: true })).toBeHidden();
    await expect(page.locator('.mobile-add')).toBeHidden();
    await page.getByRole('link', { name: 'חזרה למשימות', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'היום', exact: true, level: 1 })).toBeVisible();
  }
});
