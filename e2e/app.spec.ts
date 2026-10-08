import { test, expect, type Browser, type Page } from '@playwright/test';
import { BASE_PATH, MAIL_LOG } from '../playwright.config';

/** Playwright resolves an absolute path against the *origin*, which would drop
 *  the app's basePath. Every navigation goes through here instead. */
const at = (path: string) => `${BASE_PATH}${path}`;

/** Each run registers a fresh account, so the suite never depends on state left
 *  behind by a previous run or by the seed. */
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@seder.test`;
}

async function register(page: Page, name = 'בודק') {
  const email = uniqueEmail();
  await page.goto(at('/register'));
  await page.getByLabel('שם').fill(name);
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill('bodek-1234');
  await page.getByRole('button', { name: 'יצירת חשבון' }).click();
  await page.waitForURL('**/app/today');
  await expect(page.getByTestId('whatsapp-introduction')).toBeVisible();
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  return email;
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /בודק/ }).click();
  await page.getByRole('menuitem', { name: 'יציאה' }).click();
  await page.waitForURL('**/login');
}

/** Adds a task through the composer and closes it again. Assertions elsewhere
 *  are scoped to the list, never the whole page — the undo toast repeats the
 *  task title and would otherwise satisfy a bare text query. */
/** Completes a task and waits for the server to confirm. The row disappears
 *  after the animation, before the write lands, so asserting on the list alone
 *  would let a following navigation outrun the mutation. */
async function completeTask(page: Page, title: string) {
  await page.getByRole('checkbox', { name: new RegExp(`סימון כהושלם: ${title}`) }).click();
  // Matched on the title, not just "הושלם": a toast from a previous completion
  // is still on screen and would satisfy a looser assertion instantly.
  await expect(page.getByTestId('toasts').getByText(`הושלם: ${title}`)).toBeVisible();
}

async function addTask(page: Page, text: string) {
  await page.getByRole('button', { name: 'משימה חדשה' }).click();
  const input = page.getByLabel('משימה חדשה');
  await input.fill(text);
  await page.getByRole('button', { name: 'הוספה' }).click();

  // The composer clears itself only after the server action resolves, so an
  // empty field is proof the write landed and a following navigation cannot
  // outrun it. The confirmation toast is not usable for this: several adds in a
  // row stack identical messages, and they expire on a timer while you wait.
  await expect(input).toHaveValue('');
  await page.getByRole('button', { name: 'ביטול' }).first().click();
}

const list = (page: Page) => page.getByTestId('task-list');

test.describe('auth', () => {
  test('registers, lands on today, and stays signed in', async ({ page }) => {
    await register(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('יום');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');

    // The session cookie must not be readable from JavaScript.
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === 'seder_session');
    expect(session?.httpOnly).toBe(true);

    await page.reload();
    await expect(page).toHaveURL(/\/app\/today/);
  });

  test('rejects a wrong password with one generic message', async ({ page }) => {
    const email = await register(page);
    await logout(page);

    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill('not-the-password');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByTestId('form-error')).toHaveText('האימייל או הסיסמה לא נכונים');
  });

  test('signs back in with the right password', async ({ page }) => {
    const email = await register(page);
    await logout(page);

    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill('bodek-1234');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(/\/app\/today/);
  });

  test('sends a signed-out visitor from /app to /login', async ({ page }) => {
    await page.goto(at('/app/today'));
    await expect(page).toHaveURL(/\/login/);
  });

  test('refuses a duplicate address', async ({ page }) => {
    const email = await register(page);
    await logout(page);

    await page.goto(at('/register'));
    await page.getByLabel('שם').fill('בודק אחר');
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill('another-1234');
    await page.getByRole('button', { name: 'יצירת חשבון' }).click();
    await expect(page.getByText('כבר יש חשבון עם הכתובת הזאת')).toBeVisible();
  });
});

test.describe('settings', () => {
  async function openSettings(page: Page) {
    await page.getByRole('button', { name: /בודק/ }).click();
    await page.getByRole('menuitem', { name: 'הגדרות' }).click();
    await page.waitForURL('**/app/settings');
    await page.getByTestId('settings-overview').getByRole('link', { name: 'פרופיל', exact: true }).click();
    await page.waitForURL('**/app/settings/profile');
  }

  test('reachable from the user menu, with clear section navigation', async ({ page }) => {
    await register(page);
    await openSettings(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('פרופיל');
    for (const tab of ['פרופיל', 'סיסמה', 'מראה', 'חשבון']) {
      await expect(page.getByRole('link', { name: tab, exact: true })).toBeVisible();
    }
  });

  test('changes the display name', async ({ page }) => {
    await register(page);
    await openSettings(page);

    await page.getByLabel('שם').fill('שם חדש');
    await page.getByRole('button', { name: 'שמירה' }).click();
    await expect(page.getByText('נשמר')).toBeVisible();

    // The sidebar reads from the same record, so it must follow.
    await expect(page.getByRole('button', { name: /שם חדש/ })).toBeVisible();
  });

  test('the email is shown but not editable', async ({ page }) => {
    const email = await register(page);
    await openSettings(page);
    // Scoped to main: the sidebar user button shows the address too.
    await expect(page.getByRole('main').getByText(email)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'אימייל' })).toHaveCount(0);
  });

  test('changes the password and keeps this session signed in', async ({ page }) => {
    const email = await register(page);
    await openSettings(page);
    await page.getByRole('link', { name: 'סיסמה', exact: true }).click();

    await page.getByLabel('הסיסמה הנוכחית').fill('bodek-1234');
    await page.getByLabel('סיסמה חדשה').fill('changed-inapp-9');
    await page.getByLabel('שוב, לוודא').fill('changed-inapp-9');
    await page.getByRole('button', { name: 'עדכון סיסמה' }).click();
    await expect(page.getByText('הסיסמה עודכנה')).toBeVisible();

    // Still signed in here — signing the user out of the page they are typing
    // on would be a bug, not a security measure.
    await page.goto(at('/app/today'));
    await expect(page).toHaveURL(/\/app\/today/);

    await logout(page);
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill('changed-inapp-9');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(/\/app\/today/);
  });

  test('refuses a wrong current password', async ({ page }) => {
    await register(page);
    await openSettings(page);
    await page.getByRole('link', { name: 'סיסמה', exact: true }).click();

    await page.getByLabel('הסיסמה הנוכחית').fill('not-my-password');
    await page.getByLabel('סיסמה חדשה').fill('whatever-1234');
    await page.getByLabel('שוב, לוודא').fill('whatever-1234');
    await page.getByRole('button', { name: 'עדכון סיסמה' }).click();
    await expect(page.getByText('הסיסמה הנוכחית לא נכונה')).toBeVisible();
  });

  test('changing the password drops the other devices', async ({ browser, page }) => {
    const email = await register(page);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(at('/login'));
    await otherPage.getByLabel('אימייל').fill(email);
    await otherPage.getByLabel('סיסמה').fill('bodek-1234');
    await otherPage.getByRole('button', { name: 'כניסה' }).click();
    await expect(otherPage).toHaveURL(/\/app\/today/);

    await openSettings(page);
    await page.getByRole('link', { name: 'סיסמה', exact: true }).click();
    await page.getByLabel('הסיסמה הנוכחית').fill('bodek-1234');
    await page.getByLabel('סיסמה חדשה').fill('rotated-here-5');
    await page.getByLabel('שוב, לוודא').fill('rotated-here-5');
    await page.getByRole('button', { name: 'עדכון סיסמה' }).click();
    await expect(page.getByText('הסיסמה עודכנה')).toBeVisible();

    await otherPage.goto(at('/app/today'));
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();
  });

  test('theme choice persists across a reload', async ({ page }) => {
    await register(page);
    await openSettings(page);
    await page.getByRole('link', { name: 'מראה', exact: true }).click();

    await page.getByRole('radio', { name: 'כהה' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radio', { name: 'כהה' })).toHaveAttribute('aria-checked', 'true');

    // "system" is a real choice now — it defers to the device, which is not the
    // same as making no choice — so it stamps an attribute of its own.
    await page.getByRole('radio', { name: 'מערכת' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');

    // "light" is the default, and the default is the absence of an attribute.
    await page.getByRole('radio', { name: 'בהיר' }).click();
    await page.reload();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });

  test('accent theme applies, persists, and composes with dark mode', async ({ page }) => {
    await register(page);
    await openSettings(page);
    await page.getByRole('link', { name: 'מראה', exact: true }).click();

    /**
     * Reads the *used* accent, via a throwaway element that consumes the token.
     *
     * `getPropertyValue('--accent')` would hand back the literal
     * `light-dark(a, b)` text — custom properties are substituted at use time,
     * so the function is only evaluated where something consumes it, and the
     * raw text is identical in both themes.
     */
    const accentOf = () =>
      page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.color = 'var(--accent)';
        document.body.append(probe);
        const used = getComputedStyle(probe).color;
        probe.remove();
        return used;
      });

    const indigo = await accentOf();
    await page.getByRole('radio', { name: 'ירוק' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'green');
    const green = await accentOf();
    expect(green).not.toBe(indigo);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'green');
    await expect(page.getByRole('radio', { name: 'ירוק' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // The two axes are independent: switching mode keeps the accent.
    await page.getByRole('radio', { name: 'כהה' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'green');
    expect(await accentOf()).not.toBe(green);

    // The default accent is the absence of an attribute, like "system".
    await page.getByRole('radio', { name: 'אדום', exact: true }).click();
    await page.reload();
    await expect(page.locator('html')).not.toHaveAttribute('data-accent', /.*/);
  });

  test('each swatch previews its own colour, not the active one', async ({ page }) => {
    await register(page);
    await openSettings(page);
    await page.getByRole('link', { name: 'מראה', exact: true }).click();

    const colourOf = (name: string) =>
      page.getByRole('radio', { name }).evaluate((el) => getComputedStyle(el).backgroundColor);

    // All seven must differ from one another while indigo is the active theme.
    const colours = await Promise.all(
      ['אינדיגו', 'סגול', 'כחול', 'טורקיז', 'ירוק', 'ורוד', 'גרפיט'].map(colourOf),
    );
    expect(new Set(colours).size).toBe(colours.length);
  });

  test('the default view decides where /app lands', async ({ page }) => {
    await register(page);
    await openSettings(page);
    await page.getByRole('link', { name: 'מראה', exact: true }).click();

    await page.getByLabel('תצוגת פתיחה').selectOption('someday');
    await expect(page.getByText('נשמר')).toBeVisible();

    await page.goto(at('/app'));
    await expect(page).toHaveURL(/\/app\/someday/);
  });

  test('signs the other devices out on demand', async ({ browser, page }) => {
    const email = await register(page);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(at('/login'));
    await otherPage.getByLabel('אימייל').fill(email);
    await otherPage.getByLabel('סיסמה').fill('bodek-1234');
    await otherPage.getByRole('button', { name: 'כניסה' }).click();
    await expect(otherPage).toHaveURL(/\/app\/today/);

    await openSettings(page);
    await page.getByRole('link', { name: 'חשבון', exact: true }).click();
    await expect(page.getByText(/מחוברים עוד 1/)).toBeVisible();

    await page.getByRole('button', { name: 'ניתוק שאר המכשירים' }).click();
    await expect(page.getByTestId('toasts')).toContainText('המכשירים האחרים נותקו');

    await otherPage.goto(at('/app/today'));
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();
  });

  test('deleting the account needs the password and really deletes', async ({ page }) => {
    const email = await register(page);
    await openSettings(page);
    await page.getByRole('link', { name: 'חשבון', exact: true }).click();

    await page.getByRole('button', { name: 'מחיקת החשבון', exact: true }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('סיסמה').fill('wrong-one');
    await dialog.getByRole('button', { name: 'מחיקה לצמיתות' }).click();
    await expect(dialog.getByText('הסיסמה לא נכונה')).toBeVisible();

    await dialog.getByLabel('סיסמה').fill('bodek-1234');
    await dialog.getByRole('button', { name: 'מחיקה לצמיתות' }).click();
    // Not `/\/\?deleted=1/`: under a basePath the landing page is `/seder`,
    // with no trailing slash before the query.
    await expect(page).toHaveURL(/\?deleted=1/);

    // The account is gone, so the old credentials no longer work.
    await page.goto(at('/login'));
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill('bodek-1234');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByTestId('form-error')).toBeVisible();
  });
});

test.describe('password reset', () => {
  /** Pulls the most recent reset link for an address out of the mail log the
   *  dev transport writes to. */
  async function resetLinkFor(email: string): Promise<string> {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(MAIL_LOG, 'utf8');
    const messages = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { to: string; text: string })
      .filter((m) => m.to === email);

    expect(messages.length, `no reset mail for ${email}`).toBeGreaterThan(0);
    const link = messages.at(-1)!.text.match(/https?:\/\/\S+\/reset\/\S+/)?.[0];
    expect(link, 'mail contained no reset link').toBeTruthy();
    return link!;
  }

  async function requestReset(page: Page, email: string) {
    await page.goto(at('/forgot'));
    await page.getByLabel('אימייל').fill(email);
    await page.getByRole('button', { name: 'שליחת קישור' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('בדקו את האימייל');
  }

  test('resets the password and signs in with the new one', async ({ page }) => {
    const email = await register(page);
    await logout(page);

    await requestReset(page, email);
    await page.goto(await resetLinkFor(email));

    await page.getByLabel('סיסמה חדשה').fill('brand-new-9999');
    await page.getByLabel('שוב, לוודא').fill('brand-new-9999');
    await page.getByRole('button', { name: 'שמירת סיסמה חדשה' }).click();

    await expect(page).toHaveURL(/\/login\?reset=1/);
    await expect(page.getByText('הסיסמה עודכנה')).toBeVisible();

    // The old password no longer works…
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill('bodek-1234');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByTestId('form-error')).toBeVisible();

    // …and the new one does.
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill('brand-new-9999');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(/\/app\/today/);
  });

  test('a link cannot be used twice', async ({ page }) => {
    const email = await register(page);
    await logout(page);

    await requestReset(page, email);
    const link = await resetLinkFor(email);

    await page.goto(link);
    await page.getByLabel('סיסמה חדשה').fill('first-change-1');
    await page.getByLabel('שוב, לוודא').fill('first-change-1');
    await page.getByRole('button', { name: 'שמירת סיסמה חדשה' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('הקישור לא תקף');
  });

  test('says the same thing for an address with no account', async ({ page }) => {
    // Anything else turns the form into a way to test who is registered.
    await page.goto(at('/forgot'));
    await page.getByLabel('אימייל').fill('definitely-nobody@seder.test');
    await page.getByRole('button', { name: 'שליחת קישור' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('בדקו את האימייל');
  });

  test('rejects a mismatched confirmation', async ({ page }) => {
    const email = await register(page);
    await logout(page);
    await requestReset(page, email);
    await page.goto(await resetLinkFor(email));

    await page.getByLabel('סיסמה חדשה').fill('one-password-1');
    await page.getByLabel('שוב, לוודא').fill('other-password-2');
    await page.getByRole('button', { name: 'שמירת סיסמה חדשה' }).click();
    await expect(page.getByText('שתי הסיסמאות לא זהות')).toBeVisible();
  });

  test('a garbage token is refused', async ({ page }) => {
    await page.goto(at('/reset/not-a-real-token'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('הקישור לא תקף');
  });

  test('resetting signs out other sessions', async ({ browser, page }) => {
    const email = await register(page);

    // A second browser context stands in for another device, already signed in.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(at('/login'));
    await otherPage.getByLabel('אימייל').fill(email);
    await otherPage.getByLabel('סיסמה').fill('bodek-1234');
    await otherPage.getByRole('button', { name: 'כניסה' }).click();
    await expect(otherPage).toHaveURL(/\/app\/today/);

    await requestReset(page, email);
    await page.goto(await resetLinkFor(email));
    await page.getByLabel('סיסמה חדשה').fill('rotated-key-77');
    await page.getByLabel('שוב, לוודא').fill('rotated-key-77');
    await page.getByRole('button', { name: 'שמירת סיסמה חדשה' }).click();
    await expect(page).toHaveURL(/\/login/);

    // The other device is out: its session row was deleted with the reset.
    await otherPage.goto(at('/app/today'));
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();
  });
});

test.describe('logbook', () => {
  test('groups by completion day and pages through history', async ({ page }) => {
    await register(page);

    await addTask(page, 'משימה אחת היום');
    await addTask(page, 'משימה שתיים היום');
    await completeTask(page, 'משימה אחת');
    await completeTask(page, 'משימה שתיים');

    await page.goto(at('/app/logbook'));
    await expect(list(page).getByText('משימה אחת')).toBeVisible();
    await expect(list(page).getByText('משימה שתיים')).toBeVisible();

    // Grouped under today's heading, not one flat list.
    await expect(list(page).getByRole('heading', { name: 'היום' })).toBeVisible();

    // Nothing to add here, so no composer.
    await expect(page.getByRole('button', { name: 'משימה חדשה' })).toHaveCount(0);

    // Short history: the end is stated rather than left ambiguous.
    await expect(page.getByText('זו כל ההיסטוריה.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'טעינת עוד' })).toHaveCount(0);
  });
});

test.describe('composer pickers', () => {
  test('chooses date, hour, project and optional details without adding syntax to the title', async ({ page }) => {
    await register(page);
    await addTask(page, 'נתוני דוגמה #"טיול משפחתי" @טלפון');
    await page.getByRole('button', { name: /^משימה חדשה/ }).click();
    const composer = page.getByTestId('task-composer');
    const input = composer.getByLabel('משימה חדשה', { exact: true });
    await input.fill('לתכנן מסלול');
    for (const label of ['תאריך', 'פרויקט', 'עדיפות', 'מועד הגשה', 'תוויות', 'חזרה']) {
      await expect(composer.getByRole('button', { name: new RegExp(`^בחירת ${label},`) })).toBeVisible();
    }
    await composer.getByRole('button', { name: /^בחירת תאריך/ }).click();
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('לתכנן מסלול');
    await composer.getByRole('button', { name: /^בחירת תאריך/ }).click();
    await page.getByTestId('date-picker').getByRole('button', { name: /^מחר/ }).click();
    await composer.getByRole('button', { name: /^בחירת תאריך/ }).click();
    await page.getByTestId('date-picker').getByRole('button', { name: 'הוספת שעה', exact: true }).click();
    await page.getByLabel('שעה', { exact: true }).fill('16:30');
    await page.getByRole('button', { name: 'שמור', exact: true }).click();
    await expect(input).toHaveValue('לתכנן מסלול'); // Saving an hour must not submit the task.
    await expect(composer.getByRole('button', { name: /^בחירת תאריך/ })).toContainText('16:30');
    await composer.getByRole('button', { name: /^בחירת פרויקט/ }).click();
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('לתכנן מסלול');
    await composer.getByRole('button', { name: /^בחירת פרויקט/ }).click();
    await page.getByLabel('חיפוש פרויקטים', { exact: true }).fill('משפחתי');
    await page.getByRole('group', { name: 'פרויקטים', exact: true }).getByRole('button', { name: 'טיול משפחתי', exact: true }).click();
    await composer.getByRole('button', { name: /^בחירת עדיפות,/ }).click();
    await page.getByRole('button', { name: 'דחוף', exact: true }).click();
    await composer.getByRole('button', { name: /^בחירת מועד הגשה,/ }).click();
    await page.getByTestId('date-picker').getByRole('button', { name: 'היום', exact: true }).click();
    await composer.getByRole('button', { name: /^בחירת תוויות,/ }).click();
    await page.getByTestId('composer-properties').getByRole('button', { name: 'טלפון', exact: true }).click();
    await page.getByRole('button', { name: 'סיום', exact: true }).click();
    await expect(input).toHaveValue('לתכנן מסלול');
    await page.evaluate(() => document.fonts.ready);
    await composer.screenshot({ path: '.local-artifacts/composer-expanded-desktop.png' });
    await composer.getByRole('button', { name: 'הוספה', exact: true }).click();
    await expect(input).toHaveValue('');
    await expect(composer.getByRole('button', { name: /^בחירת פרויקט/ })).toContainText('תיבה נכנסת');
    await composer.getByRole('button', { name: 'ביטול', exact: true }).click();
    await page.getByRole('link', { name: /טיול משפחתי/ }).click();
    await page.getByRole('button', { name: 'פתיחת לתכנן מסלול', exact: true }).click();
    await expect(page.getByRole('group', { name: 'מתוזמן ל', exact: true })).toContainText('מחר');
    await expect(page.getByRole('button', { name: 'עריכת שעה', exact: true })).toHaveText('16:30');
    await expect(page.getByRole('group', { name: 'מועד הגשה', exact: true })).toContainText('היום');
    await expect(page.getByRole('combobox', { name: 'פרויקט', exact: true }).locator('option:checked')).toHaveText('טיול משפחתי');
    await expect(page.getByRole('group', { name: 'עדיפות', exact: true })).toContainText('דחוף');
    await expect(page.getByRole('group', { name: 'תוויות', exact: true })).toContainText('טלפון');
  });

  test('account preferences persist across browser contexts, keep hidden fields usable and restore full defaults', async ({ page, browser }) => {
    await register(page);
    await page.goto(at('/app/settings/quick-add'));
    await expect(page.getByLabel('הצגת תאריך', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'הקדמת פרויקט', exact: true }).click();
    await page.getByLabel('הצגת מועד הגשה', { exact: true }).uncheck();
    await page.getByLabel('הצגת תוויות', { exact: true }).uncheck();
    await page.getByLabel('הצגת חזרה', { exact: true }).uncheck();
    await page.getByLabel('שמות השדות', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'שמירת שינויים', exact: true }).click();
    await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'נשמר' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('שמות השדות', { exact: true })).not.toBeChecked();
    await expect(page.getByLabel('הצגת חזרה', { exact: true })).not.toBeChecked();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: '.local-artifacts/composer-settings-desktop.png' });

    // Fresh context has no local storage. Only the account session is shared.
    const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', storageState: { cookies: (await page.context().storageState()).cookies, origins: [] } });
    try {
      const phone = await phoneContext.newPage();
      await phone.goto(at('/app/today'));
      await phone.locator('button.mobile-add').click();
      const composer = phone.getByTestId('task-composer');
      await expect(composer.locator('[data-composer-field]')).toHaveCount(3);
      await expect(composer.locator('[data-composer-field]').first()).toHaveAttribute('data-composer-field', 'project');
      await expect(composer.getByRole('button', { name: /^בחירת עדיפות,/ })).toHaveText('');
      await composer.getByLabel('משימה חדשה', { exact: true }).fill('משימה עם שדות מוסתרים');
      await composer.getByRole('button', { name: /^פרטים נוספים/ }).click();
      await phone.getByTestId('composer-properties').getByRole('button', { name: /^חזרה/ }).click();
      await phone.getByRole('button', { name: 'כל יום', exact: true }).click();
      await composer.getByRole('button', { name: /^פרטים נוספים/ }).click();
      await phone.getByTestId('composer-properties').getByRole('button', { name: /^מועד הגשה/ }).click();
      await phone.getByTestId('date-picker').getByRole('button', { name: 'היום', exact: true }).click();
      await expect(composer.getByRole('button', { name: /^פרטים נוספים/ })).toContainText('2');
      await composer.getByRole('button', { name: 'הוספה', exact: true }).click();
      await expect(composer.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
      await phone.keyboard.press('Escape');
      await phone.reload();
      await phone.getByRole('button', { name: 'פתיחת משימה עם שדות מוסתרים', exact: true }).click();
      await expect(phone.getByRole('group', { name: 'חזרה', exact: true })).toContainText('כל יום');
      await expect(phone.getByRole('group', { name: 'מועד הגשה', exact: true })).toContainText('היום');
    } finally { await phoneContext.close(); }

    // Date and project can also be hidden; their real pickers stay in More.
    await page.goto(at('/app/settings/quick-add'));
    for (const label of ['פרויקט', 'תאריך', 'עדיפות']) await page.getByLabel(`הצגת ${label}`, { exact: true }).uncheck();
    await page.getByRole('button', { name: 'שמירת שינויים', exact: true }).click();
    await expect(page.getByText('נשמר', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(at('/app/today'));
    await page.locator('button.mobile-add').click();
    const composer = page.getByTestId('task-composer');
    await expect(composer.locator('[data-composer-field]')).toHaveCount(0);
    await composer.getByLabel('משימה חדשה', { exact: true }).fill('בחירה מתוך עוד');
    await composer.getByRole('button', { name: /^פרטים נוספים/ }).click();
    await page.getByTestId('composer-properties').getByRole('button', { name: /^תאריך/ }).click();
    let bounds = (await page.locator('[data-radix-popper-content-wrapper]').last().boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(12);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(308);
    await page.getByTestId('date-picker').getByRole('button', { name: /^מחר/ }).click();
    await composer.getByRole('button', { name: /^פרטים נוספים/ }).click();
    await page.getByTestId('composer-properties').getByRole('button', { name: /^פרויקט/ }).click();
    bounds = (await page.locator('[data-radix-popper-content-wrapper]').last().boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(12);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(308);
    await page.getByRole('group', { name: 'פרויקטים', exact: true }).getByRole('button', { name: 'עבודה', exact: true }).click();
    await composer.getByRole('button', { name: /^פרטים נוספים/ }).click();
    await page.getByRole('link', { name: 'התאמת השדות', exact: true }).click();
    await expect(page).toHaveURL(/settings\/quick-add/);
    await page.getByRole('button', { name: 'ברירת מחדל', exact: true }).click();
    await page.getByRole('button', { name: 'שמירת שינויים', exact: true }).click();
    await expect(page.getByText('נשמר', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(at('/app/today'));
    await page.getByRole('button', { name: /^משימה חדשה/ }).click();
    await expect(page.getByTestId('task-composer').locator('[data-composer-field]')).toHaveCount(6);
    await expect(page.getByTestId('task-composer').getByRole('button', { name: /^בחירת עדיפות,/ })).toHaveText('עדיפות');
  });

  test('clears an inherited day and project, and really saves an undated Inbox task', async ({ page }) => {
    await register(page);
    await page.getByRole('link', { name: /עבודה/ }).click();
    await page.getByRole('button', { name: /^משימה חדשה/ }).click();
    const composer = page.getByTestId('task-composer');
    await composer.getByLabel('משימה חדשה', { exact: true }).fill('לבדוק בהמשך');
    await expect(composer.getByRole('button', { name: /^בחירת פרויקט/ })).toContainText('עבודה');
    await composer.getByRole('button', { name: /^בחירת תאריך/ }).click();
    await page.getByTestId('date-picker').getByRole('button', { name: 'היום', exact: true }).click();
    await composer.getByRole('button', { name: /^בחירת תאריך/ }).click();
    await page.getByTestId('date-picker').getByRole('button', { name: 'ללא תאריך', exact: true }).click();
    await composer.getByRole('button', { name: /^בחירת פרויקט/ }).click();
    await page.getByRole('group', { name: 'פרויקטים', exact: true }).getByRole('button', { name: 'תיבה נכנסת', exact: true }).click();
    await composer.getByRole('button', { name: 'הוספה', exact: true }).click();
    await expect(composer.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
    await page.goto(at('/app/inbox'));
    await page.reload();
    await page.getByRole('button', { name: 'פתיחת לבדוק בהמשך', exact: true }).click();
    await expect(page.getByRole('group', { name: 'מתוזמן ל', exact: true })).toContainText('בכל עת');
    await expect(page.getByRole('combobox', { name: 'פרויקט', exact: true })).toHaveValue('');
  });

  test('phone pickers remain reachable at 320px and preserve Hebrew quick-add', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await register(page);
    await page.locator('button.mobile-add').click();
    const composer = page.getByTestId('task-composer');
    await composer.getByLabel('משימה חדשה', { exact: true }).fill('לסיים מצגת מחר בשעה 14:30 #עבודה !1');
    await expect(composer.getByRole('button', { name: /^בחירת תאריך/ })).toContainText('מחר');
    await expect(composer.getByRole('button', { name: /^בחירת פרויקט/ })).toContainText('עבודה');
    for (const name of [/^בחירת תאריך,/, /^בחירת פרויקט,/, /^בחירת עדיפות,/, /^בחירת מועד הגשה,/, /^בחירת תוויות,/, /^בחירת חזרה,/, /^פרטים נוספים/]) {
      await composer.getByRole('button', { name }).click();
      const bounds = (await page.locator('[data-radix-popper-content-wrapper]').last().boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(12);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(308);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(composer.getByLabel('משימה חדשה', { exact: true })).toHaveValue('לסיים מצגת מחר בשעה 14:30 #עבודה !1');
    }
    await composer.getByRole('button', { name: /^פרטים נוספים/ }).click();
    await page.keyboard.press('Escape');
    await expect(composer).toBeVisible();
    await expect(composer.getByLabel('משימה חדשה', { exact: true })).toHaveValue('לסיים מצגת מחר בשעה 14:30 #עבודה !1');
    await composer.getByRole('button', { name: /^בחירת תאריך/ }).click();
    const picker = page.getByTestId('date-picker');
    const box = (await picker.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    const outer = (await picker.locator('..').boundingBox())!;
    expect(outer.x).toBeGreaterThanOrEqual(12);
    expect(outer.x + outer.width).toBeLessThanOrEqual(308);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: '.local-artifacts/composer-mobile-picker.png' });
    await picker.getByRole('button', { name: 'היום', exact: true }).click();
    await expect(composer.getByLabel('משימה חדשה', { exact: true })).toHaveValue('לסיים מצגת #עבודה !1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '.local-artifacts/composer-mobile.png' });
    await composer.getByRole('button', { name: 'הוספה', exact: true }).click();
    await expect(composer.getByLabel('משימה חדשה', { exact: true })).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(list(page).getByText('לסיים מצגת', { exact: true })).toBeVisible();
  });
});

test.describe('tasks', () => {
  test('quick-add parses Hebrew and files the task in the right view', async ({ page }) => {
    await register(page);

    await page.getByRole('button', { name: 'משימה חדשה' }).click();
    await page.getByLabel('משימה חדשה').fill('לסיים מצגת מחר בשעה 14:30 #עבודה !1');

    // The composer echoes what the parser understood before anything is saved.
    const chips = page.getByTestId('composer-chips');
    await expect(chips).toContainText('מחר');
    await expect(chips).toContainText('14:30');
    await expect(chips).toContainText('עדיפות 1');
    await expect(chips).toContainText('עבודה');

    await page.getByRole('button', { name: 'הוספה' }).click();

    // Scheduled for tomorrow, so it must not show up in today — and the toast
    // has to say where it did go, or the task appears to have vanished.
    await expect(page.getByTestId('toasts')).toContainText('נוספה לבקרוב');
    await expect(list(page).getByText('לסיים מצגת')).toHaveCount(0);

    await page.goto(at('/app/upcoming'));
    await expect(list(page).getByText('לסיים מצגת')).toBeVisible();
    // The tokens were consumed, not left in the title.
    await expect(list(page).getByText('#עבודה')).toHaveCount(0);
    // …and became real metadata on the row.
    await expect(list(page).getByText('14:30')).toBeVisible();
    await expect(list(page).getByText('עבודה')).toBeVisible();
  });

  test('a dated but unfiled task stays in the Inbox', async ({ page }) => {
    await register(page);
    // The Inbox is a place, not a date. Scheduling something must not file it.
    await addTask(page, 'לתאם ביקורת מחר');

    await page.goto(at('/app/inbox'));
    await expect(list(page).getByText('לתאם ביקורת')).toBeVisible();

    // …and it is in Upcoming too, because the two axes are independent.
    await page.goto(at('/app/upcoming'));
    await expect(list(page).getByText('לתאם ביקורת')).toBeVisible();
  });

  test('filing a task into a project takes it out of the Inbox', async ({ page }) => {
    await register(page);
    await addTask(page, 'להזמין ציוד #עבודה מחר');

    await page.goto(at('/app/inbox'));
    await expect(list(page).getByText('להזמין ציוד')).toHaveCount(0);

    await page.goto(at('/app/upcoming'));
    await expect(list(page).getByText('להזמין ציוד')).toBeVisible();
  });

  test('an undated unfiled task is in the Inbox but not in בכל עת', async ({ page }) => {
    await register(page);
    await page.goto(at('/app/inbox'));
    await addTask(page, 'רעיון לבדיקה');

    await expect(list(page).getByText('רעיון לבדיקה')).toBeVisible();
    await page.goto(at('/app/anytime'));
    await expect(list(page).getByText('רעיון לבדיקה')).toHaveCount(0);
  });

  test('a project named in the quick-add appears in the sidebar', async ({ page }) => {
    await register(page);
    await addTask(page, 'לתאם ספק #רכש היום');
    await expect(page.getByRole('link', { name: /רכש/ })).toBeVisible();
  });

  test('completing a task removes it and undo restores it', async ({ page }) => {
    await register(page);
    await addTask(page, 'לקנות חלב היום');
    await expect(list(page).getByText('לקנות חלב')).toBeVisible();

    await page.getByRole('checkbox', { name: /סימון כהושלם: לקנות חלב/ }).click();
    await expect(list(page).getByText('לקנות חלב')).toHaveCount(0);

    // The undo lives in the toast, which also repeats the title.
    await page.getByTestId('toasts').getByRole('button', { name: 'ביטול' }).click();
    await expect(list(page).getByText('לקנות חלב')).toBeVisible();
  });

  test('a completed task moves to the logbook', async ({ page }) => {
    await register(page);
    await addTask(page, 'לשלוח חשבונית היום');

    await page.getByRole('checkbox', { name: /סימון כהושלם/ }).click();
    await expect(list(page).getByText('לשלוח חשבונית')).toHaveCount(0);

    await page.goto(at('/app/logbook'));
    await expect(list(page).getByText('לשלוח חשבונית')).toBeVisible();
  });

  test('a deadline is kept separate from the schedule', async ({ page }) => {
    await register(page);
    await addTask(page, 'להגיש דוח היום עד מחר');

    const row = list(page).locator('li').filter({ hasText: 'להגיש דוח' });
    await expect(row).toContainText('עד מחר');
    await row.getByRole('button', { name: 'פתיחת להגיש דוח', exact: true }).click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByRole('group', { name: 'מתוזמן ל', exact: true }).getByRole('button', { name: 'היום', exact: true })).toBeVisible();
    await expect(detail.getByRole('group', { name: 'מועד הגשה', exact: true }).getByRole('button', { name: 'מחר', exact: true })).toBeVisible();
  });

  for (const width of [1440, 390]) test(`time editing saves explicitly and preserves dates at ${width}px`, async ({ page }) => {
    await register(page);
    await addTask(page, 'בדיקת שעה היום בשעה 09:15 עד מחר');
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'פתיחת בדיקת שעה', exact: true }).click();
    const editTime = page.getByRole('button', { name: 'עריכת שעה', exact: true });
    await expect(editTime).toHaveText('09:15');
    await editTime.click();
    await page.getByLabel('שעה', { exact: true }).fill('15:45');
    // Intermediate edits must not close the picker or save part of the time.
    await expect(page.getByLabel('שעה', { exact: true })).toHaveValue('15:45');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local-artifacts/time-picker-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'שמור', exact: true }).click();
    await expect(editTime).toHaveText('15:45');
    await page.getByRole('button', { name: 'סגירה', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'פתיחת בדיקת שעה', exact: true }).click();
    await expect(editTime).toHaveText('15:45');
    await expect(page.getByRole('group', { name: 'מועד הגשה', exact: true })).toContainText('מחר');
    await editTime.click();
    await page.getByRole('button', { name: 'ללא שעה', exact: true }).click();
    await expect(page.getByRole('button', { name: 'הוספת שעה', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'מתוזמן ל', exact: true })).toContainText('היום');
  });

  test('the detail panel edits notes and adds a checklist item', async ({ page }) => {
    await register(page);
    await addTask(page, 'לארגן פגישה היום');

    await page.getByRole('button', { name: /פתיחת לארגן פגישה/ }).click();
    const panel = page.getByRole('dialog');
    for (const label of ['הערות', 'תגובה חדשה', 'פריט חדש ברשימת המשנה']) {
      await expect(panel.getByLabel(label, { exact: true })).toHaveCSS('direction', 'rtl');
    }
    await panel.getByLabel('הערות', { exact: true }).fill('Meeting notes 16:30');
    await expect(panel.getByLabel('הערות', { exact: true })).toHaveCSS('direction', 'ltr');
    await panel.getByLabel('הערות').fill('לוודא שיש חדר ישיבות');
    await expect(panel.getByLabel('הערות', { exact: true })).toHaveCSS('direction', 'rtl');
    await panel.getByLabel('פריט חדש ברשימת המשנה').fill('לשלוח זימון');
    await panel.getByLabel('פריט חדש ברשימת המשנה').press('Enter');

    await expect(panel.getByText('לשלוח זימון')).toBeVisible();
    await panel.getByRole('button', { name: 'סגירה' }).click();
    await expect(list(page).getByText('לוודא שיש חדר ישיבות')).toBeVisible();
  });

  test('keyboard: arrow selects and space completes', async ({ page }) => {
    await register(page);
    await addTask(page, 'לבדוק קיצורי מקלדת היום');

    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await expect(list(page).getByText('לבדוק קיצורי מקלדת')).toHaveCount(0);
  });
});

test.describe('organising', () => {
  test('moves a task to a project from the row menu', async ({ page }) => {
    await register(page);
    await addTask(page, 'לסדר מסמכים היום');

    await page.getByRole('button', { name: 'אפשרויות למשימה' }).click();
    await page.getByRole('menuitem', { name: 'העברה לפרויקט' }).click();
    await page.getByRole('menuitem', { name: 'עבודה' }).click();

    await expect(page.getByTestId('toasts')).toContainText('הועבר לעבודה');
    await expect(list(page).locator('li').filter({ hasText: 'לסדר מסמכים' })).toContainText(
      'עבודה',
    );

    // Filing it removes it from the Inbox — the two axes still line up.
    await page.goto(at('/app/inbox'));
    await expect(list(page).getByText('לסדר מסמכים')).toHaveCount(0);
  });

  test('unfiles a task back to the Inbox', async ({ page }) => {
    await register(page);
    await addTask(page, 'לבדוק חוזה #עבודה היום');

    await page.getByRole('button', { name: 'אפשרויות למשימה' }).click();
    await page.getByRole('menuitem', { name: 'העברה לפרויקט' }).click();
    await page.getByRole('menuitem', { name: 'תיבה נכנסת' }).click();
    await expect(page.getByTestId('toasts')).toContainText('הועבר לתיבה נכנסת');

    await page.goto(at('/app/inbox'));
    await expect(list(page).getByText('לבדוק חוזה')).toBeVisible();
  });

  test('renames a project and changes its colour', async ({ page }) => {
    await register(page);
    await page.getByRole('link', { name: /עבודה/ }).click();

    await page.getByRole('button', { name: 'אפשרויות לפרויקט' }).click();
    await page.getByRole('menuitem', { name: 'שינוי שם וצבע' }).click();
    // `getByLabel` would also match the dialog, whose accessible name is
    // "שינוי שם וצבע".
    await page.getByRole('textbox', { name: 'שם' }).fill('עבודה ולימודים');
    await page.getByRole('button', { name: 'שמירה' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('עבודה ולימודים');
    await expect(page.getByRole('link', { name: /עבודה ולימודים/ })).toBeVisible();
  });
});

test.describe('content navigation', () => {
  async function rememberShell(page: Page) {
    await page.evaluate(() => {
      (window as any).__document = document;
      (window as any).__shell = document.querySelector('[data-app-shell]');
      (window as any).__rail = document.querySelector('.rail');
      (window as any).__snapshots = 0;
      const start = document.startViewTransition?.bind(document);
      if (start) document.startViewTransition = ((...args: any[]) => { (window as any).__snapshots++; return (start as any)(...args); }) as any;
    });
  }
  async function expectContinuity(page: Page) {
    expect(await page.evaluate(() => ({ document: (window as any).__document === document, shell: (window as any).__shell === document.querySelector('[data-app-shell]'), rail: (window as any).__rail === document.querySelector('.rail'), snapshots: (window as any).__snapshots }))).toEqual({ document: true, shell: true, rail: true, snapshots: 0 });
  }
  test('Inbox, Today and Upcoming swap content without document reloads or page snapshots', async ({ page }) => {
    await register(page); await rememberShell(page);
    let documents = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
    for (const [route, label] of [['inbox', 'תיבה נכנסת'], ['upcoming', 'בקרוב'], ['today', 'היום']]) {
      await page.getByRole('link', { name: label, exact: true }).click();
      await page.waitForURL(`**/app/${route}`);
      await expect(page.getByRole('heading', { name: label, level: 1, exact: true })).toBeVisible();
      await expectContinuity(page);
    }
    expect(documents).toBe(0);
  });
  test('slow navigation keeps the current content visible until the next view is ready', async ({ page }) => {
    await register(page); await rememberShell(page);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/app/inbox*', async route => { await gate; await route.continue(); });
    try {
      await page.getByRole('link', { name: 'תיבה נכנסת', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'היום', level: 1, exact: true })).toBeVisible();
      await expectContinuity(page);
      release(); await page.waitForURL('**/app/inbox');
      await expect(page.getByRole('heading', { name: 'תיבה נכנסת', level: 1, exact: true })).toBeVisible();
    } finally { release(); }
  });
  test('rescheduling an Inbox task updates its details and counters inside the existing shell', async ({ page }) => {
    await register(page); await addTask(page, 'בדיקת תוכן מחר');
    await page.getByRole('link', { name: /^תיבה נכנסת/ }).click();
    await page.waitForURL('**/app/inbox'); await rememberShell(page);
    await list(page).getByText('בדיקת תוכן', { exact: true }).click();
    await page.getByRole('group', { name: 'מתוזמן ל', exact: true }).getByRole('button', { name: 'מחר', exact: true }).click();
    await page.getByTestId('date-picker').getByRole('button', { name: 'היום', exact: true }).click();
    await expect(page.getByTestId('toasts')).toContainText('השינויים נשמרו');
    await expect(page.getByRole('group', { name: 'מתוזמן ל', exact: true })).toContainText('היום');
    await expectContinuity(page);
  });
});

test.describe('working together', () => {
  /** Opens the share dialog on a project and returns the invitation link. */
  async function inviteLink(page: Page, projectName: string): Promise<string> {
    await page.getByRole('link', { name: new RegExp(projectName) }).click();
    await page.waitForURL('**/app/project/**');
    await page.getByRole('button', { name: 'אפשרויות לפרויקט' }).click();
    await page.getByRole('menuitem', { name: /שיתוף|האנשים בפרויקט/ }).click();
    await page.getByRole('button', { name: 'יצירת קישור' }).click();

    const link = page.getByRole('dialog').locator('code');
    await expect(link).toBeVisible();
    const href = (await link.textContent())!.trim();
    await page.keyboard.press('Escape');
    return href;
  }

  /** A second signed-in person, in their own context. */
  async function secondPerson(browser: Browser, name = 'נועה') {
    const context = await browser.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
    const page = await context.newPage();
    await register(page, name);
    return { context, page };
  }

  test('an invited person joins, sees the list, and can close a task on it', async ({
    browser,
    page,
  }) => {
    await register(page);
    await addTask(page, 'להזמין טיסות #חופשה');
    const href = await inviteLink(page, 'חופשה');

    const guest = await secondPerson(browser);
    await guest.page.goto(href);
    await guest.page.waitForURL('**/app/project/**');

    // The whole list, not just their own half of it.
    await expect(list(guest.page).getByText('להזמין טיסות')).toBeVisible();

    await completeTask(guest.page, 'להזמין טיסות');

    // And the owner sees it closed, because it is one list.
    await page.reload();
    await expect(list(page).getByText('להזמין טיסות')).toHaveCount(0);

    await guest.context.close();
  });

  test('assigning to someone else takes it off my plate but not off the list', async ({
    browser,
    page,
  }) => {
    await register(page);
    await addTask(page, 'לבדוק מלונות #חופשה היום');
    const href = await inviteLink(page, 'חופשה');

    const guest = await secondPerson(browser);
    await guest.page.goto(href);
    await guest.page.waitForURL('**/app/project/**');
    await guest.context.close();

    // Mine until it is somebody's.
    await page.goto(at('/app/today'));
    await expect(list(page).getByText('לבדוק מלונות')).toBeVisible();

    await page.locator('aside.rail').getByRole('link', { name: /חופשה/ }).click();
    await page.getByRole('button', { name: 'אפשרויות למשימה' }).click();
    await page.getByRole('menuitem', { name: 'נועה', exact: true }).click();
    await expect(page.getByTestId('toasts')).toContainText('הוקצה לנועה');

    // Still on the shared list — it is not gone, it is theirs.
    await expect(list(page).getByText('לבדוק מלונות')).toBeVisible();

    // Gone from my Today, which is the point of assigning it.
    await page.goto(at('/app/today'));
    await expect(list(page).getByText('לבדוק מלונות')).toHaveCount(0);
  });

  test('sharing a project shares nothing else', async ({ browser, page }) => {
    await register(page);
    // One unfiled task, which lives in the Inbox and has no project to inherit
    // access from, and one inside the project that gets shared.
    await addTask(page, 'סוד שלי');
    await addTask(page, 'לשכור רכב #חופשה');
    const href = await inviteLink(page, 'חופשה');

    const guest = await secondPerson(browser);
    await guest.page.goto(href);
    await guest.page.waitForURL('**/app/project/**');

    await expect(list(guest.page).getByText('לשכור רכב')).toBeVisible();

    // The Inbox is "no project", so there is nothing for sharing to reach.
    await guest.page.goto(at('/app/inbox'));
    await expect(list(guest.page).getByText('סוד שלי')).toHaveCount(0);

    // Nor through search, which is the other way a task could leak.
    await guest.page.goto(at('/app/today'));
    await guest.page.keyboard.press('Control+k');
    await guest.page.getByRole('dialog').getByRole('combobox').fill('סוד');
    await expect(guest.page.getByText('סוד שלי')).toHaveCount(0);

    await guest.context.close();
  });

  test('a stranger cannot open the project by its address', async ({ browser, page }) => {
    await register(page);
    await addTask(page, 'לארוז #חופשה');
    await page.getByRole('link', { name: /חופשה/ }).click();
    await page.waitForURL('**/app/project/**');
    const url = page.url();

    // Never invited, just holding the address.
    const stranger = await secondPerson(browser);
    await stranger.page.goto(url);
    await expect(stranger.page.getByText('הדף הזה לא קיים')).toBeVisible();
    await expect(stranger.page.getByText('לארוז')).toHaveCount(0);

    await stranger.context.close();
  });

  test('an expired-looking or nonsense invitation is refused', async ({ page }) => {
    await register(page);
    await page.goto(at('/app/join/not-a-real-token'));
    await expect(page.getByText('ההזמנה לא נקלטה')).toBeVisible();
  });
});

test.describe('multi-select', () => {
  /** Opens the selection on one row. Ctrl-click is the way in from a plain
   *  list — the checkboxes only appear once a selection exists. */
  async function selectFirst(page: Page, title: string) {
    await page.getByRole('button', { name: `פתיחת ${title}` }).click({ modifiers: ['Control'] });
    await expect(page.getByTestId('bulk-bar')).toBeVisible();
  }

  const bar = (page: Page) => page.getByTestId('bulk-bar');

  test('ctrl-click opens the bar and the checkboxes appear', async ({ page }) => {
    await register(page);
    await addTask(page, 'אלף היום');
    await addTask(page, 'בית היום');

    // No selection, no checkboxes — the row is not in a mode it never entered.
    await expect(page.getByRole('checkbox', { name: /^בחירת/ })).toHaveCount(0);
    await expect(bar(page)).toBeHidden();

    await selectFirst(page, 'אלף');
    await expect(bar(page)).toContainText('1');
    // Now every row offers a way in, not just the one that was modifier-clicked.
    await expect(page.getByRole('checkbox', { name: /^בחירת/ })).toHaveCount(2);
    await expect(page.getByRole('checkbox', { name: 'בחירת אלף' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('shift-click takes the range, and only adds', async ({ page }) => {
    await register(page);
    for (const title of ['אלף', 'בית', 'גימל', 'דלת']) await addTask(page, `${title} היום`);

    // Newest first, so the visual order is דלת, גימל, בית, אלף.
    await selectFirst(page, 'גימל');
    await page.getByRole('checkbox', { name: 'בחירת אלף' }).click({ modifiers: ['Shift'] });
    await expect(bar(page)).toContainText('3');

    // Shifting back over an already-selected span must not deselect it.
    await page.getByRole('checkbox', { name: 'בחירת בית' }).click({ modifiers: ['Shift'] });
    await expect(bar(page)).toContainText('3');
  });

  test('completes a selection, and undo brings all of it back', async ({ page }) => {
    await register(page);
    await addTask(page, 'אלף היום');
    await addTask(page, 'בית היום');

    await selectFirst(page, 'אלף');
    await page.getByRole('checkbox', { name: 'בחירת בית' }).click();
    await expect(bar(page)).toContainText('2');

    await bar(page).getByRole('button', { name: 'השלמה' }).click();
    await expect(page.getByTestId('toasts')).toContainText('2 משימות הושלמו');
    await expect(list(page).getByText('אלף')).toHaveCount(0);
    await expect(list(page).getByText('בית')).toHaveCount(0);
    // The bar goes with the selection it described.
    await expect(bar(page)).toBeHidden();

    await page.getByRole('button', { name: 'ביטול' }).first().click();
    await expect(list(page).getByText('אלף')).toBeVisible();
    await expect(list(page).getByText('בית')).toBeVisible();
  });

  test('a repeating task in the batch advances instead of finishing', async ({ page }) => {
    await register(page);
    await addTask(page, 'משימה רגילה היום');
    await addTask(page, 'לבדוק גיבויים כל יום');

    await selectFirst(page, 'משימה רגילה');
    await page.getByRole('checkbox', { name: /^בחירת לבדוק גיבויים/ }).click();
    await bar(page).getByRole('button', { name: 'השלמה' }).click();

    // The count is honest about what happened to each: one finished, one moved.
    await expect(page.getByTestId('toasts')).toContainText('2 הושלמו · 1 חוזרות בהמשך');

    // The repeat is alive on its next date, not sitting in the Logbook as dead.
    await page.goto(at('/app/upcoming'));
    await expect(list(page).getByText('לבדוק גיבויים')).toBeVisible();
  });

  test('reschedules and moves a selection in one go', async ({ page }) => {
    await register(page);
    await addTask(page, 'אלף היום');
    await addTask(page, 'בית היום');

    await selectFirst(page, 'אלף');
    await page.getByRole('checkbox', { name: 'בחירת בית' }).click();
    await bar(page).getByRole('button', { name: 'מתי' }).click();
    await page.getByRole('menuitem', { name: /מחר/ }).click();
    await expect(page.getByTestId('toasts')).toContainText('2 משימות תוזמנו מחדש');

    await page.goto(at('/app/upcoming'));
    await expect(list(page).getByText('אלף')).toBeVisible();

    await page.getByRole('button', { name: 'פתיחת אלף' }).click({ modifiers: ['Control'] });
    await bar(page).getByRole('button', { name: 'העברה לפרויקט' }).click();
    await page.getByRole('menuitem', { name: 'עבודה' }).click();
    await expect(page.getByTestId('toasts')).toContainText('1 משימות הועברו לעבודה');
  });

  test('bulk delete asks first, and Escape clears the selection', async ({ page }) => {
    await register(page);
    await addTask(page, 'אלף היום');
    await addTask(page, 'בית היום');

    await selectFirst(page, 'אלף');
    await page.getByRole('checkbox', { name: 'בחירת בית' }).click();

    // Deletion is the one bulk verb with no undo, so it earns a confirm.
    await bar(page).getByRole('button', { name: 'מחיקה' }).click();
    await expect(page.getByRole('dialog')).toContainText('למחוק 2 משימות?');
    await page.getByRole('dialog').getByRole('button', { name: 'ביטול' }).click();
    await expect(list(page).getByText('אלף')).toBeVisible();

    // Escape drops the selection before it touches the keyboard cursor.
    await page.keyboard.press('Escape');
    await expect(bar(page)).toBeHidden();
    await expect(page.getByRole('checkbox', { name: /^בחירת/ })).toHaveCount(0);

    await selectFirst(page, 'אלף');
    await page.getByRole('checkbox', { name: 'בחירת בית' }).click();
    await bar(page).getByRole('button', { name: 'מחיקה' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'מחיקה' }).click();
    await expect(page.getByTestId('toasts')).toContainText('2 משימות נמחקו');
    await expect(list(page).getByText('אלף')).toHaveCount(0);
  });

  test('the Logbook has no selection to offer', async ({ page }) => {
    await register(page);
    await addTask(page, 'אלף היום');
    await completeTask(page, 'אלף');

    await page.goto(at('/app/logbook'));
    await expect(list(page).getByText('אלף')).toBeVisible();
    await page.getByRole('button', { name: 'פתיחת אלף' }).click({ modifiers: ['Control'] });
    await expect(page.getByTestId('bulk-bar')).toBeHidden();
  });
});

test.describe('repeating tasks', () => {
  test('quick-add reads a Hebrew repeat phrase', async ({ page }) => {
    await register(page);

    await page.getByRole('button', { name: 'משימה חדשה' }).click();
    await page.getByLabel('משימה חדשה').fill('להשקות את הצמחים כל יומיים');
    await expect(page.getByTestId('composer-chips')).toContainText('כל יומיים');
    await page.getByRole('button', { name: 'הוספה' }).click();
    await expect(page.getByLabel('משימה חדשה')).toHaveValue('');
    await page.getByRole('button', { name: 'ביטול' }).first().click();

    const row = list(page).locator('li').filter({ hasText: 'להשקות את הצמחים' });
    await expect(row).toContainText('כל יומיים');
  });

  test('completing a repeat advances it instead of finishing it', async ({ page }) => {
    await register(page);
    await addTask(page, 'לבדוק גיבויים כל יום');

    // It starts today.
    await expect(list(page).getByText('לבדוק גיבויים')).toBeVisible();

    await page.getByRole('checkbox', { name: /סימון כהושלם: לבדוק גיבויים/ }).click();
    // Gone from today, and the toast says where it went rather than "done".
    await expect(list(page).getByText('לבדוק גיבויים')).toHaveCount(0);
    await expect(page.getByTestId('toasts')).toContainText('חוזר במחר');

    // Still open, now scheduled for tomorrow.
    await page.goto(at('/app/upcoming'));
    await expect(list(page).getByText('לבדוק גיבויים')).toBeVisible();

    // …and the completed occurrence is logged.
    await page.goto(at('/app/logbook'));
    await expect(list(page).getByText('לבדוק גיבויים')).toBeVisible();
  });

  test('undo puts a repeat back and removes the logged copy', async ({ page }) => {
    await register(page);
    await addTask(page, 'למדוד לחץ דם כל יום');

    await page.getByRole('checkbox', { name: /סימון כהושלם: למדוד לחץ דם/ }).click();
    await page.getByTestId('toasts').getByRole('button', { name: 'ביטול' }).click();

    // Back on today…
    await expect(list(page).getByText('למדוד לחץ דם')).toBeVisible();
    // …and the Logbook entry is gone with it.
    await page.goto(at('/app/logbook'));
    await expect(list(page).getByText('למדוד לחץ דם')).toHaveCount(0);
  });

  test('the detail panel sets and clears a repeat', async ({ page }) => {
    await register(page);
    await addTask(page, 'לנקות את המקרר היום');

    await page.getByRole('button', { name: /פתיחת לנקות את המקרר/ }).click();
    const panel = page.getByRole('dialog');

    await panel.getByRole('button', { name: 'לא חוזרת' }).click();
    await page.getByRole('menuitem', { name: 'כל יום', exact: true }).click();
    await expect(panel.getByRole('button', { name: /כל יום/ })).toBeVisible();

    await panel.getByRole('button', { name: /כל יום/ }).click();
    await page.getByRole('menuitem', { name: 'לא חוזרת' }).click();
    await expect(panel.getByRole('button', { name: 'לא חוזרת' })).toBeVisible();
  });
});

test.describe('calendar', () => {
  const cell = (page: Page, iso: string) => page.locator(`[data-day="${iso}"]`);

  test('month grid runs Sunday-first from the right', async ({ page }) => {
    await register(page);
    await page.goto(at('/app/calendar'));

    const headers = await page.locator('[data-day]').first().evaluate(() => null);
    expect(headers).toBeNull();

    // Column order is logical (Sunday first); RTL puts column one on the right,
    // so Sunday must sit further right than Saturday.
    const days = page.locator('[data-day]');
    const sunday = (await days.nth(0).boundingBox())!;
    const saturday = (await days.nth(6).boundingBox())!;
    expect(sunday.x).toBeGreaterThan(saturday.x);
  });

  test('shows both calendars and marks today', async ({ page }) => {
    await register(page);
    await page.goto(at('/app/calendar'));

    // The Hebrew month range is in the header, in gematria.
    const header = page.getByRole('heading', { level: 1 });
    await expect(header).toBeVisible();
    await expect(page.locator('main')).toContainText('ה׳תש');

    const today = new Date();
    const iso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(today);
    await expect(cell(page, iso)).toHaveCount(1);
  });

  test('a scheduled task appears on its day and a deadline on its own', async ({ page }) => {
    await register(page);
    await addTask(page, 'להגיש דוח מחר עד מחרתיים');
    await page.goto(at('/app/calendar'));

    const base = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const day = (offset: number) => {
      const d = new Date(`${base}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    await expect(cell(page, day(1))).toContainText('להגיש דוח');
    await expect(cell(page, day(2))).toContainText('להגיש דוח');
  });

  test('navigates months and back to today', async ({ page }) => {
    await register(page);
    await page.goto(at('/app/calendar'));
    const heading = page.getByRole('heading', { level: 1 });
    const start = (await heading.textContent())!;

    await page.getByRole('link', { name: 'לתקופה הבאה' }).click();
    await expect(heading).not.toHaveText(start);

    await page.getByRole('main').getByRole('link', { name: 'היום' }).click();
    await expect(heading).toHaveText(start);
  });

  test('switches to the week view', async ({ page }) => {
    await register(page);
    await page.goto(at('/app/calendar'));
    await page.getByRole('link', { name: 'שבוע', exact: true }).click();
    await expect(page).toHaveURL(/v=week/);
    await expect(page.locator('[data-day]')).toHaveCount(7);
  });

  test('dragging a task to another day reschedules it', async ({ page }) => {
    await register(page);
    await addTask(page, 'לתאם פגישה היום');
    await page.goto(at('/app/calendar'));

    const base = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const next = new Date(`${base}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 2);
    const targetIso = next.toISOString().slice(0, 10);

    await expect(cell(page, base)).toContainText('לתאם פגישה');

    const chip = cell(page, base).getByRole('button', { name: /לתאם פגישה/ }).first();
    const target = cell(page, targetIso);
    const from = (await chip.boundingBox())!;
    const to = (await target.boundingBox())!;

    // dnd-kit needs intermediate moves past its 4px activation distance.
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 20, from.y + from.height / 2 + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
    await page.mouse.up();

    await expect(cell(page, targetIso)).toContainText('לתאם פגישה');
    await expect(cell(page, base)).not.toContainText('לתאם פגישה');

    // And it survives a reload, so the move was persisted, not just optimistic.
    await page.reload();
    await expect(cell(page, targetIso)).toContainText('לתאם פגישה');
  });

  test('the day panel adds a task onto that day', async ({ page }) => {
    await register(page);
    await page.goto(at('/app/calendar'));

    const base = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const target = new Date(`${base}T00:00:00.000Z`);
    target.setUTCDate(target.getUTCDate() + 3);
    const targetIso = target.toISOString().slice(0, 10);

    await cell(page, targetIso).getByRole('button').first().click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();

    await panel.getByLabel('משימה חדשה').fill('לבדוק את הלוח');
    await panel.getByRole('button', { name: 'הוספה' }).click();
    await expect(page.getByTestId('toasts')).toContainText('נוספה');

    await panel.getByRole('button', { name: 'סגירה' }).click();
    await expect(cell(page, targetIso)).toContainText('לבדוק את הלוח');
  });

  test('the date picker sets a schedule and a deadline separately', async ({ page }) => {
    await register(page);
    await addTask(page, 'לתכנן רבעון');

    await page.getByRole('button', { name: /פתיחת לתכנן רבעון/ }).click();
    const panel = page.getByRole('dialog');

    const picker = page.getByTestId('date-picker');

    // Added from Today, so the schedule control starts on "היום".
    await panel.getByRole('button', { name: 'היום', exact: true }).click();
    await expect(picker).toHaveAttribute('data-variant', 'schedule');
    // The quick rows carry a weekday hint, so the name is "מחר <weekday>".
    await picker.getByRole('button', { name: /^מחר/ }).click();
    await expect(panel.getByRole('button', { name: 'מחר', exact: true })).toBeVisible();

    // The deadline is a separate control and starts empty.
    await panel.getByRole('button', { name: 'ללא', exact: true }).click();
    await expect(picker).toHaveAttribute('data-variant', 'deadline');
    await picker.getByRole('button', { name: /^שבוע הבא/ }).click();
    await expect(panel.getByRole('button', { name: 'ללא', exact: true })).toHaveCount(0);
    // Setting a deadline must not disturb the schedule.
    await expect(panel.getByRole('button', { name: 'מחר', exact: true })).toBeVisible();
    await page.reload();
    await expect(panel.getByRole('group', { name: 'מועד הגשה', exact: true }).getByRole('button', { name: 'ללא', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('group', { name: 'מתוזמן ל', exact: true }).getByRole('button', { name: 'מחר', exact: true })).toBeVisible();
  });
});

test.describe('rtl', () => {
  test('the document is RTL and Hebrew', async ({ page }) => {
    await register(page);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'he');
  });

  test('the sidebar sits on the right and the detail panel on the left', async ({ page }) => {
    await register(page);

    // Measure against the content box, not the viewport: in RTL the scrollbar
    // gutter takes a slice off one side.
    const contentWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const sidebar = (await page.locator('aside.rail').boundingBox())!;
    const main = (await page.locator('main').boundingBox())!;

    // Inline-start in RTL is the right edge.
    expect(sidebar.x + sidebar.width).toBeGreaterThanOrEqual(contentWidth - 1);
    expect(sidebar.x).toBeGreaterThan(main.x + main.width - 1);

    await addTask(page, 'משימה לבדיקת פאנל היום');
    await page.getByRole('button', { name: /פתיחת משימה לבדיקת פאנל/ }).click();

    // The task editor is a centred modal, so the RTL question is not which
    // edge it clings to but how it is built inside: content on the reading
    // edge, the settings rail at the inline-end. Centring is checked too,
    // because `m-auto` is what keeps it direction-agnostic — a translate would
    // put it in the same place here and the wrong place in LTR.
    const dialog = page.getByRole('dialog');
    const box = (await dialog.boundingBox())!;
    expect(Math.abs(box.x - (contentWidth - box.x - box.width))).toBeLessThanOrEqual(2);

    const rail = (await dialog.locator('aside').boundingBox())!;
    const title = (await dialog.getByLabel('שם המשימה').boundingBox())!;
    expect(rail.x + rail.width).toBeLessThanOrEqual(title.x + 1);
  });

  test('a dropdown opens without overflowing the left edge', async ({ page }) => {
    await register(page);
    await addTask(page, 'משימה לבדיקת תפריט היום');

    await page.getByRole('button', { name: 'אפשרויות למשימה' }).click();
    const menu = (await page.getByRole('menu').boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
  });

  test('mixed-direction content keeps its order', async ({ page }) => {
    await register(page);
    const mixed = 'שלום John 050-1234567 ₪1,234';
    await addTask(page, `${mixed} מחר`);

    await page.goto(at('/app/upcoming'));
    await expect(list(page).getByText(mixed)).toBeVisible();
  });

  test('the command palette opens on Ctrl+K and navigates', async ({ page }) => {
    await register(page);
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder(/חיפוש משימה/)).toBeVisible();
    await page.getByRole('option', { name: /מתישהו/ }).first().click();
    await expect(page).toHaveURL(/\/app\/someday/);
  });

  test('the palette finds a task by title and by note', async ({ page }) => {
    await register(page);
    await addTask(page, 'לתאם בדיקת רכב היום');

    await page.getByRole('button', { name: /פתיחת לתאם בדיקת רכב/ }).click();
    await page.getByRole('dialog').getByLabel('הערות').fill('לשאול על צמיגים');
    await page.getByRole('dialog').getByRole('button', { name: 'סגירה' }).click();

    // By title.
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder(/חיפוש משימה/).fill('בדיקת רכב');
    const palette = page.getByTestId('palette-list');
    await expect(palette.getByText('לתאם בדיקת רכב')).toBeVisible();

    // By note — text that appears nowhere in the item label, which is why the
    // palette's own fuzzy filter has to stay out of the way.
    await page.getByPlaceholder(/חיפוש משימה/).fill('צמיגים');
    await expect(palette.getByText('לתאם בדיקת רכב')).toBeVisible();

    // Selecting a result opens the task itself.
    await palette.getByText('לתאם בדיקת רכב').click();
    await expect(page.getByRole('dialog').getByLabel('שם המשימה')).toHaveValue(
      'לתאם בדיקת רכב',
    );
  });

  test('the palette reports an honest miss', async ({ page }) => {
    await register(page);
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder(/חיפוש משימה/).fill('קסדרלבנה');
    await expect(page.getByText('לא נמצא כלום.')).toBeVisible();
  });

  test('today shows completed count without a progress rail', async ({ page }) => {
    await register(page);
    await addTask(page, 'משימה ראשונה היום');
    await addTask(page, 'משימה שנייה היום');

    await expect(page.getByRole('progressbar')).toHaveCount(0);

    await page.getByRole('checkbox', { name: /סימון כהושלם: משימה ראשונה/ }).click();
    await expect(page.getByLabel('הושלמו 1 מתוך 2 משימות היום')).toBeVisible();
  });
});
