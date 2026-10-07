import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { getAdminOverview } from './overview';

const mocks = vi.hoisted(() => ({ db: null as unknown as PrismaClient, session: null as null | { sessionId: string; user: { id: string; name: string; email: string; role: string } } }));
vi.mock('server-only', () => ({}));
vi.mock('../db', () => ({ get db() { return mocks.db; } }));
vi.mock('../auth/session', () => ({ getCurrentSession: async () => mocks.session }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock('../whatsapp/status', () => ({ readWhatsappState: async () => ({ status: 'READY', stale: true, qr: 'secret-pairing-image' }) }));
vi.mock('../google/client', () => ({ googleConfigured: () => false }));

const prefix = 'admin-overview-test-';
let userId: string;
let adminId: string;

beforeAll(async () => {
  if (!existsSync('prisma/admin-test.db')) writeFileSync('prisma/admin-test.db', '');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: 'file:./admin-test.db' }, stdio: 'pipe' });
  mocks.db = new PrismaClient({ datasourceUrl: 'file:./admin-test.db' });
  await mocks.db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  const user = await mocks.db.user.create({ data: { name: 'איילה', email: `${prefix}user@seder.test`, passwordHash: 'private-password-hash', lastActiveAt: new Date() } });
  const admin = await mocks.db.user.create({ data: { name: 'מנהל', email: `${prefix}admin@seder.test`, passwordHash: 'admin-private-hash', role: 'admin' } });
  userId = user.id; adminId = admin.id;
  await mocks.db.task.createMany({ data: [
    { userId, title: 'PRIVATE TASK TEXT', notes: 'PRIVATE NOTES', position: 'a0' },
    { userId, title: 'PRIVATE COMPLETED TASK', position: 'a1', status: 'DONE', completedAt: new Date() },
    { userId: adminId, title: 'ADMIN TASK NOT A CUSTOMER', position: 'a0' },
  ] });
});
beforeEach(() => { mocks.session = { sessionId: 'session', user: { id: adminId, name: 'מנהל', email: `${prefix}admin@seder.test`, role: 'admin' } }; });
afterAll(async () => { await mocks.db?.user.deleteMany({ where: { email: { startsWith: prefix } } }); await mocks.db?.$disconnect(); });

describe('protected admin overview', () => {
  it('rejects an ordinary account before exposing cross-account data', async () => {
    mocks.session!.user.role = 'user';
    await expect(getAdminOverview()).rejects.toThrow('NOT_FOUND');
  });
  it('rejects missing or forged sessions', async () => {
    mocks.session = null;
    await expect(getAdminOverview()).rejects.toThrow('REDIRECT:/signed-out?next=%2Fadmin');
  });
  it('aggregates customer use, excludes admin accounts, and omits sensitive fields', async () => {
    const data = await getAdminOverview();
    expect(data.totals).toMatchObject({ users: 1, active: 1, newUsers: 1, open: 1, created: 2, completed: 1 });
    expect(data.users).toHaveLength(1);
    expect(data.users[0]).toMatchObject({ id: userId, open: 1, completed: 1 });
    expect(data.days.reduce((sum, day) => sum + day.created, 0)).toBe(2);
    const rendered = JSON.stringify(data);
    expect(rendered).not.toContain('PRIVATE');
    expect(rendered).not.toContain('passwordHash');
    expect(rendered).not.toContain('private-password-hash');
    expect(rendered).not.toContain('secret-pairing-image');
    expect(data.services.whatsapp.stale).toBe(true);
  });
  it('applies user search and clamps an out-of-range page', async () => {
    expect((await getAdminOverview({ q: 'איילה', page: '999' })).users).toHaveLength(1);
    expect((await getAdminOverview({ q: 'missing-user' })).users).toEqual([]);
    expect((await getAdminOverview({ page: '999' })).page).toBe(1);
  });
});
