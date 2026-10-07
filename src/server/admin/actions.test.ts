import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { sendUserPasswordResetAction } from './actions';
import { requestPasswordReset, findResetTarget, completePasswordReset } from '../auth/reset';
import { requestResetAction } from '../auth/actions';

const mocks = vi.hoisted(() => ({ db: null as unknown as PrismaClient, mail: vi.fn(), session: null as null | { sessionId: string; user: { id: string; email: string; role: string } } }));
vi.mock('server-only', () => ({}));
vi.mock('../db', () => ({ get db() { return mocks.db; } }));
vi.mock('../auth/session', () => ({ getCurrentSession: async () => mocks.session, createSession: vi.fn(), destroyCurrentSession: vi.fn() }));
vi.mock('../mail', () => ({ sendMail: mocks.mail, appUrl: () => 'https://seder.test/seder', emailHtml: () => '<p>Test email</p>' }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));

const prefix = 'admin-reset-test-';
let targetId: string;
let administratorId: string;
const email = `${prefix}recipient@seder.test`;

beforeAll(async () => {
  if (!existsSync('prisma/admin-reset-test.db')) writeFileSync('prisma/admin-reset-test.db', '');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: 'file:./admin-reset-test.db' }, stdio: 'pipe' });
  mocks.db = new PrismaClient({ datasourceUrl: 'file:./admin-reset-test.db' });
});
beforeEach(async () => {
  vi.clearAllMocks();
  await mocks.db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  const target = await mocks.db.user.create({ data: { email, name: 'משתמש בדיקה', passwordHash: 'unchanged-password-hash' } });
  const admin = await mocks.db.user.create({ data: { email: `${prefix}admin@seder.test`, name: 'מנהל בדיקה', role: 'admin', passwordHash: 'administrator-password-hash' } });
  targetId = target.id; administratorId = admin.id;
  await mocks.db.session.create({ data: { userId: targetId, tokenHash: 'existing-user-session', expiresAt: new Date(Date.now() + 86_400_000) } });
  mocks.session = { sessionId: 'admin-session', user: { id: administratorId, email: admin.email, role: 'admin' } };
  mocks.mail.mockResolvedValue({ delivered: true, provider: 'smtp', id: 'accepted-message' });
});
afterAll(async () => { await mocks.db?.user.deleteMany({ where: { email: { startsWith: prefix } } }); await mocks.db?.$disconnect(); });

describe('administrator password recovery', () => {
  it('rejects ordinary accounts and missing sessions before sending anything', async () => {
    mocks.session!.user.role = 'user';
    await expect(sendUserPasswordResetAction(targetId)).rejects.toThrow('NOT_FOUND');
    mocks.session = null;
    await expect(sendUserPasswordResetAction(targetId)).rejects.toThrow('REDIRECT');
    expect(mocks.mail).not.toHaveBeenCalled();
    expect(await mocks.db.passwordResetToken.count()).toBe(0);
  });
  it('rejects another administrator, missing targets and malformed IDs', async () => {
    expect((await sendUserPasswordResetAction(administratorId)).status).toBe('error');
    expect((await sendUserPasswordResetAction('missing')).status).toBe('error');
    expect((await sendUserPasswordResetAction(null as unknown as string)).status).toBe('error');
    expect(mocks.mail).not.toHaveBeenCalled();
  });
  it('sends only to the stored address, stores only a token hash and preserves password and sessions', async () => {
    const state = await sendUserPasswordResetAction(targetId);
    expect(state.status).toBe('sent');
    const mail = mocks.mail.mock.calls[0][0];
    expect(mail.to).toBe(email);
    const raw = mail.text.match(/\/reset\/([A-Za-z0-9_-]+)/)![1];
    const token = await mocks.db.passwordResetToken.findFirstOrThrow({ where: { userId: targetId } });
    expect(token.tokenHash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(token.expiresAt.getTime() - Date.now()).toBeGreaterThan(3_590_000);
    expect(JSON.stringify(state)).not.toContain(raw);
    expect((await mocks.db.user.findUniqueOrThrow({ where: { id: targetId } })).passwordHash).toBe('unchanged-password-hash');
    expect(await mocks.db.session.count({ where: { userId: targetId } })).toBe(1);
  });
  it('reports delivery failure and removes the unusable token', async () => {
    mocks.mail.mockRejectedValue(new Error('provider rejected'));
    expect((await sendUserPasswordResetAction(targetId)).status).toBe('error');
    expect(await mocks.db.passwordResetToken.count()).toBe(0);
    expect(await mocks.db.session.count({ where: { userId: targetId } })).toBe(1);
  });
  it('labels previews truthfully and throttles repeated requests', async () => {
    mocks.mail.mockResolvedValue({ delivered: false, provider: 'preview' });
    expect((await sendUserPasswordResetAction(targetId)).status).toBe('preview');
    expect((await sendUserPasswordResetAction(targetId)).status).toBe('rate_limited');
    expect(mocks.mail).toHaveBeenCalledTimes(1);
  });
  it('serializes concurrent requests so only one email is issued', async () => {
    const results = await Promise.all([requestPasswordReset(email), requestPasswordReset(email)]);
    expect(results.map((result) => result.status).sort()).toEqual(['rate_limited', 'sent']);
    expect(mocks.mail).toHaveBeenCalledTimes(1);
    expect(await mocks.db.passwordResetToken.count()).toBe(1);
  });
  it('caps existing links and clears expired links before issuing a new one', async () => {
    await mocks.db.passwordResetToken.createMany({ data: [0, 1, 2].map((index) => ({ userId: targetId, tokenHash: `existing-${index}`, createdAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() + 180_000) })) });
    expect((await requestPasswordReset(email)).status).toBe('rate_limited');
    expect(mocks.mail).not.toHaveBeenCalled();
    await mocks.db.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await requestPasswordReset(email)).status).toBe('sent');
    expect(await mocks.db.passwordResetToken.count()).toBe(1);
  });
  it('leaves the public response identical for known, throttled and unknown emails', async () => {
    const data = (address: string) => { const form = new FormData(); form.set('email', address); return form; };
    expect((await requestResetAction({}, data(email))).sent).toBe(true);
    expect((await requestResetAction({}, data(email))).sent).toBe(true);
    expect((await requestResetAction({}, data('missing@seder.test'))).sent).toBe(true);
  });
  it('lets the recipient consume the link once, then revokes sessions and outstanding links', async () => {
    await sendUserPasswordResetAction(targetId);
    const raw = mocks.mail.mock.calls[0][0].text.match(/\/reset\/([A-Za-z0-9_-]+)/)![1];
    const target = await findResetTarget(raw);
    expect(target).not.toBeNull();
    await completePasswordReset(target!, 'new-recipient-selected-hash');
    expect((await mocks.db.user.findUniqueOrThrow({ where: { id: targetId } })).passwordHash).toBe('new-recipient-selected-hash');
    expect(await mocks.db.session.count({ where: { userId: targetId } })).toBe(0);
    expect(await findResetTarget(raw)).toBeNull();
  });
});
