import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { addDays, today } from '@/lib/dates';
import { rescheduleDate } from '@/lib/reschedule';

const auth = vi.hoisted(() => ({ userId: '' }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/session', () => ({ requireUser: async () => {
  if (!auth.userId) throw new Error('AUTH_REQUIRED');
  return { id: auth.userId };
} }));
vi.mock('@/server/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { db: new PrismaClient() };
});

import { db } from '@/server/db';
import { rescheduleOverdueAction } from './actions';

const users: string[] = [];
const ids: string[] = [];
beforeAll(async () => {
  for (const suffix of ['owner', 'stranger']) {
    const user = await db.user.create({ data: { email: `reschedule-${Date.now()}-${suffix}@test.local`, name: 'בדיקת תזמון', passwordHash: 'synthetic-test' } });
    users.push(user.id);
  }
  auth.userId = users[0];
  for (const [index, preset] of [null, 'tomorrow', 'next-week', 'tomorrow', 'next-week', 'tomorrow'].entries()) {
    const task = await db.task.create({ data: {
      userId: index === 5 ? users[1] : users[0], title: `בדיקת תזמון ${index}`, position: `a${index}`,
      whenBucket: 'SCHEDULED', scheduledFor: addDays(today(), index === 4 ? 3 : -2),
      reschedulePreset: preset, scheduledTime: '09:00', remindedAt: new Date(),
      status: index === 3 ? 'DONE' : 'TODO', deadline: addDays(today(), 5),
    } });
    ids.push(task.id);
  }
});
afterAll(async () => {
  await db.task.deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

describe('authorized overdue rescheduling against SQL', () => {
  it('sets a different destination per task and ignores completed, future and private foreign tasks', async () => {
    const before = await db.task.findMany({ where: { id: { in: ids } } });
    expect(await rescheduleOverdueAction(ids)).toEqual({ ok: true, count: 3 });
    const after = await db.task.findMany({ where: { id: { in: ids } } });
    for (const id of ids.slice(0, 3)) {
      const task = after.find(task => task.id === id)!;
      expect(task.scheduledFor).toEqual(rescheduleDate(task.reschedulePreset));
      expect(task.scheduledTime).toBeNull();
      expect(task.remindedAt).toBeNull();
      expect(task.deadline).toEqual(before.find(task => task.id === id)!.deadline);
      expect(task.reschedulePreset).toBe(before.find(task => task.id === id)!.reschedulePreset);
    }
    for (const id of ids.slice(3)) expect(after.find(task => task.id === id)).toEqual(before.find(task => task.id === id));
    expect(await rescheduleOverdueAction(ids)).toEqual({ ok: true, count: 0 });
  });
  it('requires an authenticated account', async () => {
    auth.userId = '';
    await expect(rescheduleOverdueAction(ids)).rejects.toThrow('AUTH_REQUIRED');
    auth.userId = users[0];
  });
});
