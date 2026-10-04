'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { requireSession } from '@/server/auth/session';
import { normalizePhone } from '@/lib/phone';
import type { SettingsState } from '@/server/settings/actions';
import { writeFile, link, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readWhatsappState, WHATSAPP_STATUS_FILE } from '@/server/whatsapp/status';

function refresh() {
  revalidatePath('/app', 'layout');
}

async function writeWorkerRequest(name: string, payload: object): Promise<void> {
  const destination = join(dirname(WHATSAPP_STATUS_FILE), name);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(payload), { mode: 0o600, flag: 'wx' });
  try { await link(temporary, destination); } // Atomic publication, including exclusivity.
  finally { await unlink(temporary).catch(() => {}); }
}

export async function markWhatsappIntroductionSeenAction(): Promise<void> {
  const { user } = await requireSession();
  await db.user.updateMany({ where: { id: user.id, whatsappIntroSeenAt: null }, data: { whatsappIntroSeenAt: new Date() } });
}

/** Only the named operator may replace a logged-out service pairing. */
export async function requestWhatsappPairingAction(): Promise<SettingsState> {
  const { user } = await requireSession();
  const admin = process.env.SEDER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin || user.email.toLowerCase() !== admin) return { errors: { pairing: 'רק מנהל השירות יכול לחבר את המכשיר.' } };
  const state = await readWhatsappState();
  if (state.status === 'READY' && !state.stale) return { errors: { pairing: 'השירות כבר מחובר.' } };
  if (state.stale || state.status === 'OFFLINE') return { errors: { pairing: 'השירות אינו מגיב. צריך להפעיל אותו בשרת.' } };
  if (state.status === 'NEEDS_SCAN' || state.status === 'INITIALIZING') return { saved: true };
  try {
    await writeWorkerRequest('whatsapp-pairing-request.json', { id: randomUUID(), requestedAt: Date.now() });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return { errors: { pairing: 'לא הצלחנו להתחיל את החיבור. נסו שוב.' } };
  }
  return { saved: true };
}

/** An explicit test sends to this account's saved, opted-in number only. */
export async function sendWhatsappTestAction(): Promise<SettingsState> {
  const { user } = await requireSession();
  const admin = process.env.SEDER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin || user.email.toLowerCase() !== admin) return { errors: { test: 'רק מנהל השירות יכול לשלוח בדיקת חיבור.' } };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, whatsappReminders: true } });
  if (!row.phone || !row.whatsappReminders) return { errors: { test: 'צריך לשמור מספר ולהפעיל קבלת תזכורות.' } };
  const state = await readWhatsappState();
  if (state.status !== 'READY' || state.stale) return { errors: { test: 'צריך לחבר את השירות לפני שליחת בדיקה.' } };
  const recent = await db.whatsappLog.count({ where: { userId: user.id, body: 'בדיקת תזכורות: החיבור לסדר פעיל.', createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recent) return { errors: { test: 'אפשר לשלוח בדיקה אחת בדקה.' } };
  try {
    await writeWorkerRequest('whatsapp-test-request.json', { userId: user.id, requestedAt: Date.now() });
  } catch { return { errors: { test: 'בדיקה כבר ממתינה לשליחה. נסו שוב בעוד רגע.' } }; }
  return { saved: true };
}

/**
 * Save the number messages will arrive from.
 *
 * Clearing it switches both features off. A switch left on with no number is a
 * setting that claims to be working and cannot possibly be — and the reminder
 * sweep would keep selecting the row only to skip it.
 */
export async function updatePhoneAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { user } = await requireSession();
  const raw = String(formData.get('phone') ?? '').trim();

  if (!raw) {
    await db.user.update({
      where: { id: user.id },
      data: { phone: null, whatsappCapture: false, whatsappReminders: false },
    });
    refresh();
    return { saved: true };
  }

  const phone = normalizePhone(raw);
  if (!phone) {
    return { errors: { phone: 'צריך מספר נייד ישראלי, למשל 054-123-4567' } };
  }

  try {
    await db.user.update({ where: { id: user.id }, data: { phone } });
  } catch (error) {
    // The column is unique so that an incoming message has exactly one owner.
    // Saying "already in use" is not a leak: whoever holds that number can
    // confirm it themselves by sending a message.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { errors: { phone: 'המספר הזה כבר משויך לחשבון אחר' } };
    }
    throw error;
  }

  refresh();
  return { saved: true };
}

/**
 * The hour an untimed task's reminder fires.
 *
 * One setting for the account rather than a field on every task: "remind me
 * about the day's undated things in the morning" is a habit, and asking for it
 * on every task would be a question with the same answer forever.
 */
export async function setReminderHourAction(hour: number): Promise<SettingsState> {
  const { user } = await requireSession();

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { errors: { reminderHour: 'שעה לא תקינה' } };
  }

  await db.user.update({ where: { id: user.id }, data: { reminderHour: hour } });
  refresh();
  return { saved: true };
}

/** Which of the two WhatsApp features a switch controls. */
export type WhatsappSwitch = 'capture' | 'reminders';

/**
 * Turn one of the two features on or off.
 *
 * They are separate because they are separate permissions: letting the app
 * read your messages and turn them into tasks is a different decision from
 * letting it message you. Either can be on without the other.
 */
export async function setWhatsappSwitchAction(
  which: WhatsappSwitch,
  enabled: boolean,
): Promise<SettingsState> {
  const { user } = await requireSession();

  const row = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } });
  if (enabled && !row?.phone) {
    return { errors: { [which]: 'צריך לשמור מספר טלפון קודם' } };
  }

  await db.user.update({
    where: { id: user.id },
    data: which === 'capture' ? { whatsappCapture: enabled } : { whatsappReminders: enabled },
  });
  refresh();
  return { saved: true };
}
