import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BASE_PATH } from '../playwright.config';
import { today, addDays } from '../src/lib/dates';

const db = new PrismaClient();
const evidence = '.impeccable/review/desktop-scale';
const at = (path: string) => `${BASE_PATH}${path}`;
test.afterAll(() => db.$disconnect());

async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.task-title').first()).toBeVisible();
}
async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    const title = box('.task-title');
    const check = box('.task-complete-control');
    const rail = box('.rail');
    const content = box('.workspace-content');
    return {
      width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
      titleAxis: title.right, headingAxis: box('.view-heading h1').right,
      composerAxis: box('.task-add-trigger > span').right,
      sidebarGap: rail.left - content.right,
      text: parseFloat(style('.task-title').fontSize),
      icon: box('.rail-link > svg').width, rail: rail.width,
      checkboxCenter: check.top + check.height / 2,
      titleCenter: title.top + parseFloat(style('.task-title').lineHeight) / 2,
    };
  });
}

test('desktop reading scale, shared alignment, zoom, editor wrapping and device preference', async ({ page, context }) => {
  test.setTimeout(180_000);
  mkdirSync(evidence, { recursive: true });
  const email = `desktop-scale-${Date.now()}@seder.test`;
  await page.goto(at('/register'));
  await page.getByLabel('שם', { exact: true }).fill('בדיקת מחשב');
  await page.getByLabel('אימייל', { exact: true }).fill(email);
  await page.getByLabel('סיסמה', { exact: true }).fill('desktop-scale-test-123');
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await page.waitForURL('**/app/today');
  await page.getByTestId('whatsapp-introduction').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const titles = ['לשים מים ברכב', 'להכין תוכנית עבודה לשבוע הקרוב', 'לדבר עם צוות AIG על ההצעה', 'לקנות ספר', 'לקבוע פגישה עם הצוות', 'לסדר את המסמכים', 'לבדוק את הגרסה החדשה', 'להכין מצגת לפגישה', 'לעבור על התקציב', 'להחזיר תשובה למיכל', 'להזמין ציוד למשרד', 'לקחת את הילדים לגן', 'לעדכן את היומן', 'לבדוק את רשימת הקניות', 'לשלוח את התוכנית', 'להוסיף רעיונות לפרויקט', 'להשלים את התכנון'];
  try {
    await db.task.createMany({ data: titles.map((title, i) => ({ userId: user.id, title, position: `a${String(i).padStart(2, '0')}`, priority: i % 5 === 0 ? 1 : 4, notes: i === 2 ? 'להשוות תנאים ולחזור עם תשובה מסודרת' : null, whenBucket: i % 3 === 1 ? 'SCHEDULED' : 'ANYTIME', scheduledFor: i % 3 === 1 ? addDays(today(), -1) : null })) });
    await page.goto(at('/app/inbox'));
    await ready(page);
    const measurements = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1888, 1280, 1440, 2560]) {
      await page.setViewportSize({ width, height: 912 });
      const metric = await geometry(page); measurements.push(metric);
      expect(metric.overflow).toBe(false);
      expect(metric.sidebarGap).toBeCloseTo(0, 0);
      expect(Math.abs(metric.titleAxis - metric.headingAxis)).toBeLessThanOrEqual(1);
      expect(Math.abs(metric.titleAxis - metric.composerAxis)).toBeLessThanOrEqual(1);
      expect(Math.abs(metric.checkboxCenter - metric.titleCenter)).toBeLessThanOrEqual(1);
      expect(metric.text).toBeGreaterThanOrEqual(18);
      await page.screenshot({ animations: 'disabled', path: `${evidence}/desktop-${width}.png` });
    }
    const zoom = await page.context().browser()!.newContext({ storageState: await context.storageState(), locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 2517, height: 1216 }, deviceScaleFactor: .75 });
    const zoomPage = await zoom.newPage();
    await zoomPage.goto(at('/app/inbox'));
    await ready(zoomPage);
    measurements.push(await geometry(zoomPage));
    await zoomPage.screenshot({ animations: 'disabled', path: `${evidence}/desktop-75-percent.png` });
    await zoom.close();
    await page.setViewportSize({ width: 1888, height: 912 });
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await page.screenshot({ animations: 'disabled', path: `${evidence}/desktop-dark.png` });
    await page.evaluate(() => document.documentElement.dataset.theme = 'light');

    async function states(suffix = '') {
    await page.locator('.task-content').first().click({ modifiers: ['Control'] });
    await expect(page.locator('.task-select-control').first()).toBeVisible();
    const selection = await geometry(page);
    expect(Math.abs(selection.titleAxis - selection.headingAxis)).toBeLessThanOrEqual(1);
    expect(Math.abs(selection.titleAxis - selection.composerAxis)).toBeLessThanOrEqual(1);
    const selectCenter = await page.locator('.task-select-control').first().evaluate(node => { const box = node.getBoundingClientRect(); return box.top + box.height / 2; });
    expect(Math.abs(selection.titleCenter - selectCenter)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: 'disabled', path: `${evidence}/desktop-selection${suffix}.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'צמצום הסרגל', exact: true }).click();
    await expect.poll(async () => (await page.locator('.rail').boundingBox())!.width).toBe(68);
    const centers = await page.locator('.rail-link > svg, .rail-add > svg, .rail-search > svg, .rail-header button[aria-label="פתיחת הסרגל"] > svg').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return {center: box.right - box.width / 2, width: box.width}; }).filter(box => box.width > 0).map(box => box.center));
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: 'disabled', path: `${evidence}/desktop-collapsed${suffix}.png` });
    await page.getByRole('button', { name: 'פתיחת הסרגל', exact: true }).click();
    await expect.poll(async () => (await page.locator('.rail').boundingBox())!.width).toBe(suffix ? 296 : 280);
    }
    await states();
    await page.goto(at('/app/settings/appearance'));
    await page.getByRole('radio', { name: 'גדול', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'גדול', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ animations: 'disabled', path: `${evidence}/settings-large.png` });
    await page.goto(at('/app/inbox'));
    const large = await geometry(page);
    expect(large.text).toBeGreaterThan(measurements[0].text);
    expect(large.icon).toBeGreaterThan(measurements[0].icon);
    await page.screenshot({ animations: 'disabled', path: `${evidence}/desktop-large.png` });
    await states('-large');
    await page.getByRole('button', { name: `פתיחת ${titles[0]}`, exact: true }).click();
    const longTitle = 'להכין מסמך מסודר לקראת הפגישה עם הצוות ולעבור על כל ההערות לפני הפרסום — Release notes ' + 'LongUnbrokenTaskName'.repeat(7);
    await page.getByLabel('שם המשימה', { exact: true }).fill(longTitle);
    await page.getByLabel('הערות', { exact: true }).click();
    await expect.poll(async () => page.getByLabel('שם המשימה').evaluate(field => ({ clipped: field.scrollHeight > field.clientHeight + 1, height: field.clientHeight }))).toMatchObject({ clipped: false });
    expect(await page.getByLabel('שם המשימה').evaluate(field => field.clientHeight)).toBeGreaterThan(60);
    await page.screenshot({ animations: 'disabled', path: `${evidence}/editor-long-title.png` });
    await page.reload();
    await expect(page.getByLabel('שם המשימה')).toHaveValue(longTitle);
    await page.getByRole('button', { name: 'סגירה', exact: true }).click();
    await page.goto(at('/app/settings/appearance'));
    await page.getByRole('radio', { name: 'קומפקטי', exact: true }).click();
    await page.goto(at('/app/inbox'));
    expect((await geometry(page)).text).toBeLessThan(measurements[0].text);
    await page.goto(at('/app/settings/appearance'));
    await page.getByRole('radio', { name: 'נוח', exact: true }).click();

    const project = await db.project.findFirstOrThrow({ where: { userId: user.id } });
    await db.task.create({ data: { userId: user.id, projectId: project.id, title: 'תוכנית הפרויקט עם טקסט ארוך ומובן', position: 'a0' } });
    await page.goto(at(`/app/project/${project.id}?projectView=list`));
    await ready(page);
    const list = await geometry(page);
    expect(Math.abs(list.titleAxis - list.headingAxis)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: 'disabled', path: `${evidence}/project-list.png` });
    await page.getByRole('button', { name: 'לוח', exact: true }).click();
    await expect(page.getByTestId('project-board')).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: `${evidence}/project-board.png` });
    await page.goBack();
    await expect(page.getByTestId('task-list')).toBeVisible();

    await page.goto(at('/app/inbox'));
    for (const width of [944, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await geometry(page)).text).toBe(17);
      await page.screenshot({ animations: 'disabled', path: `${evidence}/${width >= 640 ? 'zoom-200' : 'mobile'}-${width}.png` });
    }
    expect(errors).toEqual([]);
    writeFileSync(`${evidence}/metrics.json`, JSON.stringify(measurements, null, 2));
  } finally {
    await db.user.deleteMany({ where: { id: user.id, email } });
  }
});
