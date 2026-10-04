/**
 * Demo data so the app is legible the moment it starts: one user, three
 * projects and a spread of tasks that lands something in every view.
 *
 *   npm run db:seed      →  demo@seder.app / demo1234
 */

import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { generateNKeysBetween } from 'fractional-indexing';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const db = new PrismaClient();

const EMAIL = 'demo@seder.app';
const PASSWORD = 'demo1234';

/** A second account, so shared projects have somebody to be shared *with*.
 *  Collaboration is the one feature that cannot be demonstrated single-handed. */
const PARTNER_EMAIL = 'partner@seder.app';
const PARTNER_PASSWORD = 'demo1234';

/** UTC midnight, `offset` days from today — matching how the app stores dates. */
function day(offset: number): Date {
  const now = new Date();
  const base = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  base.setUTCDate(base.getUTCDate() + offset);
  return base;
}

async function main() {
  await db.user.deleteMany({ where: { email: EMAIL } });

  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: 'דמו',
      passwordHash: await hash(PASSWORD, {
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
        outputLen: 32,
      }),
    },
  });

  // No Inbox project — an unfiled task (projectId null) *is* the Inbox.
  const projectKeys = generateNKeysBetween(null, null, 3);
  const [work, home, trip] = await Promise.all([
    db.project.create({
      data: { userId: user.id, name: 'עבודה', color: 'teal', position: projectKeys[0] },
    }),
    db.project.create({
      data: { userId: user.id, name: 'בית', color: 'clay', position: projectKeys[1] },
    }),
    db.project.create({
      data: { userId: user.id, name: 'טיול ליוון', color: 'plum', position: projectKeys[2] },
    }),
  ]);

  const sectionKeys = generateNKeysBetween(null, null, 2);
  const [beforeFlight, onSite] = await Promise.all([
    db.section.create({
      data: { projectId: trip.id, name: 'לפני הטיסה', position: sectionKeys[0] },
    }),
    db.section.create({
      data: { projectId: trip.id, name: 'בשטח', position: sectionKeys[1] },
    }),
  ]);

  const labelKeys = generateNKeysBetween(null, null, 3);
  const [phone, computer, errands] = await Promise.all([
    db.label.create({
      data: { userId: user.id, name: 'טלפון', color: 'plum', position: labelKeys[0] },
    }),
    db.label.create({
      data: { userId: user.id, name: 'מחשב', color: 'slate', position: labelKeys[1] },
    }),
    db.label.create({
      data: { userId: user.id, name: 'סידורים', color: 'moss', position: labelKeys[2] },
    }),
  ]);

  interface Row {
    title: string;
    notes?: string;
    priority?: number;
    bucket: string;
    scheduledFor?: Date;
    scheduledTime?: string;
    deadline?: Date;
    projectId?: string;
    sectionId?: string;
    labelIds?: string[];
    status?: string;
    completedAt?: Date;
    recurrence?: string;
    subtasks?: string[];
  }

  const rows: Row[] = [
    // Overdue — the "נגרר מקודם" group on Today.
    {
      title: 'להחזיר טופס למחלקת כוח אדם',
      priority: 2,
      bucket: 'SCHEDULED',
      scheduledFor: day(-2),
      projectId: work.id,
      labelIds: [computer.id],
    },
    // Today.
    {
      title: 'לסיים את המצגת לרבעון',
      notes: 'שקף הסיכום עוד חסר את מספרי יולי.',
      priority: 1,
      bucket: 'SCHEDULED',
      scheduledFor: day(0),
      scheduledTime: '14:30',
      deadline: day(1),
      projectId: work.id,
      labelIds: [computer.id],
      subtasks: ['לאסוף את הנתונים', 'לכתוב את שקף הסיכום', 'לשלוח לרוני להערות'],
    },
    {
      title: 'להתקשר למוסך לגבי הטיפול',
      priority: 3,
      bucket: 'SCHEDULED',
      scheduledFor: day(0),
      projectId: home.id,
      labelIds: [phone.id],
    },
    {
      title: 'לקנות חלב, לחם וקפה',
      bucket: 'SCHEDULED',
      scheduledFor: day(0),
      projectId: home.id,
      labelIds: [errands.id],
    },
    // Upcoming.
    {
      title: 'פגישת סטטוס עם הצוות',
      bucket: 'SCHEDULED',
      scheduledFor: day(1),
      scheduledTime: '09:00',
      projectId: work.id,
    },
    {
      title: 'להזמין כרטיסים למוזיאון',
      bucket: 'SCHEDULED',
      scheduledFor: day(3),
      projectId: trip.id,
      sectionId: beforeFlight.id,
      labelIds: [computer.id],
    },
    {
      title: 'לחדש את הדרכון',
      priority: 1,
      bucket: 'SCHEDULED',
      scheduledFor: day(5),
      deadline: day(12),
      projectId: trip.id,
      sectionId: beforeFlight.id,
      labelIds: [errands.id],
    },
    {
      title: 'להגיש דוח הוצאות',
      priority: 2,
      bucket: 'SCHEDULED',
      scheduledFor: day(7),
      deadline: day(9),
      projectId: work.id,
    },
    // Anytime.
    {
      title: 'לתקן את הברז במטבח',
      bucket: 'ANYTIME',
      projectId: home.id,
    },
    {
      title: 'לבדוק ביטוח נסיעות',
      bucket: 'ANYTIME',
      projectId: trip.id,
      sectionId: beforeFlight.id,
      labelIds: [computer.id],
    },
    {
      title: 'למצוא מסעדה בסנטוריני',
      bucket: 'ANYTIME',
      projectId: trip.id,
      sectionId: onSite.id,
    },
    // Inbox — no project, which is exactly what "unsorted" means here. One of
    // them is dated, to show that scheduling does not file a task.
    { title: 'רעיון: להעביר את הצוות לסבב שבועי', bucket: 'ANYTIME' },
    { title: 'לבדוק את ההצעה מספק הענן', bucket: 'ANYTIME', labelIds: [computer.id] },
    {
      title: 'להתקשר לרואה החשבון',
      bucket: 'SCHEDULED',
      scheduledFor: day(1),
      labelIds: [phone.id],
    },
    // Repeating.
    {
      title: 'ישיבת צוות שבועית',
      bucket: 'SCHEDULED',
      scheduledFor: day(0),
      scheduledTime: '10:00',
      projectId: work.id,
      recurrence: 'weekly:1:0',
    },
    {
      title: 'להשקות את הצמחים',
      bucket: 'SCHEDULED',
      scheduledFor: day(0),
      projectId: home.id,
      recurrence: 'daily:3',
    },
    // Someday.
    { title: 'ללמוד לנגן בגיטרה', bucket: 'SOMEDAY' },
    { title: 'לארגן את האלבומים מ־2019', bucket: 'SOMEDAY', projectId: home.id },
    // Logbook.
    {
      title: 'לשלוח חשבונית לספטמבר',
      bucket: 'SCHEDULED',
      scheduledFor: day(-1),
      projectId: work.id,
      status: 'DONE',
      completedAt: day(0),
    },
    {
      title: 'לקבוע תור לרופא שיניים',
      bucket: 'SCHEDULED',
      scheduledFor: day(-3),
      projectId: home.id,
      labelIds: [phone.id],
      status: 'DONE',
      completedAt: day(-3),
    },
  ];

  const positions = generateNKeysBetween(null, null, rows.length);

  for (const [index, row] of rows.entries()) {
    const task = await db.task.create({
      data: {
        userId: user.id,
        title: row.title,
        notes: row.notes,
        priority: row.priority ?? 4,
        status: row.status ?? 'TODO',
        completedAt: row.completedAt,
        whenBucket: row.bucket,
        scheduledFor: row.scheduledFor,
        scheduledTime: row.scheduledTime,
        deadline: row.deadline,
        recurrence: row.recurrence,
        projectId: row.projectId ?? null,
        sectionId: row.sectionId,
        position: positions[index],
        labels: row.labelIds?.length
          ? { create: row.labelIds.map((labelId) => ({ labelId })) }
          : undefined,
      },
    });

    if (row.subtasks?.length) {
      const subPositions = generateNKeysBetween(null, null, row.subtasks.length);
      await db.task.createMany({
        data: row.subtasks.map((title, i) => ({
          userId: user.id,
          parentId: task.id,
          projectId: row.projectId ?? null,
          title,
          whenBucket: 'ANYTIME',
          position: subPositions[i],
          status: i === 0 ? 'DONE' : 'TODO',
          completedAt: i === 0 ? new Date() : null,
        })),
      });
    }
  }

  /* The trip is the natural thing to plan with somebody else, so that is the
     one that gets shared — and one of its tasks is handed over, so the assignee
     avatar and the "not in my Today" rule are both visible from a cold start. */
  const partner = await db.user.upsert({
    where: { email: PARTNER_EMAIL },
    update: {},
    create: {
      email: PARTNER_EMAIL,
      name: 'נועה',
      passwordHash: await hash(PARTNER_PASSWORD),
    },
  });

  const sharedTrip = await db.project.findFirst({
    where: { userId: user.id, name: 'טיול ליוון' },
    select: { id: true },
  });

  if (sharedTrip) {
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId: sharedTrip.id, userId: partner.id } },
      update: {},
      create: { projectId: sharedTrip.id, userId: partner.id },
    });

    const first = await db.task.findFirst({
      where: { projectId: sharedTrip.id, parentId: null, status: 'TODO' },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    if (first) {
      await db.task.update({ where: { id: first.id }, data: { assigneeId: partner.id } });
    }
  }

  const [projectCount, labelCount, inboxCount] = await Promise.all([
    db.project.count({ where: { userId: user.id } }),
    db.label.count({ where: { userId: user.id } }),
    db.task.count({ where: { userId: user.id, parentId: null, projectId: null } }),
  ]);

  console.log(`נוצר משתמש דמו: ${EMAIL} / ${PASSWORD}`);
  console.log(`שותפה לדוגמה: ${PARTNER_EMAIL} / ${PARTNER_PASSWORD} — חברה ב״טיול ליוון״.`);
  console.log(
    `${rows.length} משימות (${inboxCount} בתיבה הנכנסת), ${projectCount} פרויקטים, ${labelCount} תוויות.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
