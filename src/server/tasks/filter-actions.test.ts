import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ userId: '' }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/session', () => ({ requireUser: async () => { if (!auth.userId) throw new Error('AUTH_REQUIRED'); return { id: auth.userId }; } }));
vi.mock('@/server/db', async () => { const { PrismaClient } = await import('@prisma/client'); return { db: new PrismaClient() }; });
import { db } from '@/server/db';
import { updateFilterAction } from './filter-actions';

const users: string[] = [];
let savedId: string;
let privateProject: string;
beforeAll(async () => {
  for (const suffix of ['owner', 'outsider']) users.push((await db.user.create({ data: { email: `filter-update-${Date.now()}-${suffix}@test.local`, name: 'בדיקת מסנן', passwordHash: 'synthetic-test' } })).id);
  auth.userId = users[0];
  savedId = (await db.savedFilter.create({ data: { userId: users[0], name: 'המסנן שלי', config: '{}' } })).id;
  privateProject = (await db.project.create({ data: { userId: users[1], name: 'פרטי', position: 'a0' } })).id;
});
afterAll(async () => { await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); });

describe('saved filter updates against SQL', () => {
  it('updates criteria without changing the saved identity or creating another filter', async () => {
    expect(await updateFilterAction(savedId, { priority: '2', when: 'overdue' })).toEqual({ ok: true });
    const saved = await db.savedFilter.findUniqueOrThrow({ where: { id: savedId } });
    expect(saved.name).toBe('המסנן שלי');
    expect(JSON.parse(saved.config)).toMatchObject({ priority: '2', when: 'overdue' });
    expect(await db.savedFilter.count({ where: { userId: users[0] } })).toBe(1);
  });
  it('cannot update another account filter', async () => {
    const before = await db.savedFilter.findUniqueOrThrow({ where: { id: savedId } });
    auth.userId = users[1];
    expect((await updateFilterAction(savedId, { priority: '1' })).ok).toBe(false);
    expect(await db.savedFilter.findUniqueOrThrow({ where: { id: savedId } })).toEqual(before);
    auth.userId = users[0];
  });
  it('rejects invalid criteria and inaccessible projects without changing the filter', async () => {
    const before = await db.savedFilter.findUniqueOrThrow({ where: { id: savedId } });
    expect((await updateFilterAction(savedId, { priority: '999' })).ok).toBe(false);
    expect((await updateFilterAction(savedId, { projectId: privateProject })).ok).toBe(false);
    expect((await updateFilterAction('', {})).ok).toBe(false);
    expect(await db.savedFilter.findUniqueOrThrow({ where: { id: savedId } })).toEqual(before);
  });
  it('requires an authenticated account', async () => {
    auth.userId = '';
    await expect(updateFilterAction(savedId, {})).rejects.toThrow('AUTH_REQUIRED');
    auth.userId = users[0];
  });
});
