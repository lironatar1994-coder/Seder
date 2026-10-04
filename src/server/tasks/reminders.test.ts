import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { REMINDER_OFF } from '@/lib/reminder';
import { timedDueWhere, untimedDueWhere } from './reminders';

/**
 * The one test in this suite that talks to a database.
 *
 * It is here because the bug it guards against is invisible to every other
 * kind: `NOT: { reminder: 'off' }` reads correctly, typechecks, and excludes
 * every task whose reminder is null — which is the default, so all of them.
 * Nothing throws. Reminders simply never arrive.
 *
 * Asserting on the shape of the where-clause would just re-state the bug.
 * Only running it against SQL, where NULL is not false, can tell the
 * difference.
 */

const db = new PrismaClient();

const DAY = new Date('2031-03-05T00:00:00.000Z'); // far from any real data
let userId: string;
const made: string[] = [];

async function task(over: {
  reminder?: string | null;
  scheduledTime?: string | null;
  status?: string;
}): Promise<string> {
  const created = await db.task.create({
    data: {
      userId,
      title: 'reminder filter fixture',
      whenBucket: 'SCHEDULED',
      scheduledFor: DAY,
      scheduledTime: over.scheduledTime ?? null,
      reminder: over.reminder ?? null,
      status: over.status ?? 'TODO',
      position: `zzz${made.length}`,
    },
    select: { id: true },
  });
  made.push(created.id);
  return created.id;
}

beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email: `reminders-${Date.now()}@test.local`,
      name: 'בודק',
      passwordHash: 'x',
      phone: `05${String(Date.now()).slice(-8)}`,
      whatsappCapture: true,
      whatsappReminders: true,
    },
    select: { id: true },
  });
  userId = user.id;
});

afterAll(async () => {
  await db.task.deleteMany({ where: { id: { in: made } } });
  await db.user.delete({ where: { id: userId } }).catch(() => {});
  await db.$disconnect();
});

describe('timedDueWhere', () => {
  it('selects tomorrow`s task and yesterday`s late reminder for fire-time checks', async () => {
    const future = await task({ scheduledTime: '09:30', reminder: '1440' });
    const previous = await task({ scheduledTime: '23:55', reminder: '0' });
    await db.task.update({ where: { id: future }, data: { scheduledFor: new Date(DAY.getTime() + 86400000) } });
    await db.task.update({ where: { id: previous }, data: { scheduledFor: new Date(DAY.getTime() - 86400000) } });
    const found = await db.task.findMany({ where: timedDueWhere(DAY), select: { id: true } });
    expect(found.map(t => t.id)).toEqual(expect.arrayContaining([future, previous]));
  });
  it('includes a task that never asked for anything in particular', async () => {
    // The regression. `reminder` is null for every task nobody has touched,
    // and the obvious filter spellings drop exactly those.
    const id = await task({ scheduledTime: '09:15', reminder: null });
    const found = await db.task.findMany({ where: timedDueWhere(DAY), select: { id: true } });
    expect(found.map((t) => t.id)).toContain(id);
  });

  it('includes a task with an explicit lead', async () => {
    const id = await task({ scheduledTime: '10:00', reminder: '60' });
    const found = await db.task.findMany({ where: timedDueWhere(DAY), select: { id: true } });
    expect(found.map((t) => t.id)).toContain(id);
  });

  it('excludes a task that turned its reminder off', async () => {
    const id = await task({ scheduledTime: '11:00', reminder: REMINDER_OFF });
    const found = await db.task.findMany({ where: timedDueWhere(DAY), select: { id: true } });
    expect(found.map((t) => t.id)).not.toContain(id);
  });

  it('excludes a task with no time — that is the morning note`s job', async () => {
    const id = await task({ scheduledTime: null });
    const found = await db.task.findMany({ where: timedDueWhere(DAY), select: { id: true } });
    expect(found.map((t) => t.id)).not.toContain(id);
  });

  it('excludes a task already done', async () => {
    const id = await task({ scheduledTime: '12:00', status: 'DONE' });
    const found = await db.task.findMany({ where: timedDueWhere(DAY), select: { id: true } });
    expect(found.map((t) => t.id)).not.toContain(id);
  });
});

describe('untimedDueWhere', () => {
  it('selects a future task whose day-before reminder fires today', async () => {
    const id = await task({ reminder: '1440' });
    await db.task.update({ where: { id }, data: { scheduledFor: new Date(DAY.getTime() + 86400000) } });
    const found = await db.task.findMany({ where: untimedDueWhere(DAY), select: { id: true } });
    expect(found.map(t => t.id)).toContain(id);
  });
  it('includes a dated task with no time and no opinion', async () => {
    const id = await task({ scheduledTime: null, reminder: null });
    const found = await db.task.findMany({ where: untimedDueWhere(DAY), select: { id: true } });
    expect(found.map((t) => t.id)).toContain(id);
  });

  it('excludes one that turned its reminder off', async () => {
    const id = await task({ scheduledTime: null, reminder: REMINDER_OFF });
    const found = await db.task.findMany({ where: untimedDueWhere(DAY), select: { id: true } });
    expect(found.map((t) => t.id)).not.toContain(id);
  });
});

describe('the recipient filter survives being combined', () => {
  it('drops a task whose owner has WhatsApp switched off', async () => {
    // Both halves of the filter carry their own OR. Spread into one object
    // instead of AND-ed, the second would overwrite the first and this would
    // pass for the wrong reason.
    const other = await db.user.create({
      data: {
        email: `reminders-off-${Date.now()}@test.local`,
        name: 'בודק',
        passwordHash: 'x',
        whatsappCapture: false,
        whatsappReminders: false,
      },
      select: { id: true },
    });

    const created = await db.task.create({
      data: {
        userId: other.id,
        title: 'no whatsapp',
        whenBucket: 'SCHEDULED',
        scheduledFor: DAY,
        scheduledTime: '09:00',
        position: 'zzzq',
      },
      select: { id: true },
    });

    const found = await db.task.findMany({ where: timedDueWhere(DAY), select: { id: true } });
    expect(found.map((t) => t.id)).not.toContain(created.id);

    await db.task.delete({ where: { id: created.id } });
    await db.user.delete({ where: { id: other.id } });
  });
});
