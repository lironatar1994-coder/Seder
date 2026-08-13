'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { requireSession } from '@/server/auth/session';
import { normalizePhone } from '@/lib/phone';
import type { SettingsState } from '@/server/settings/actions';

function refresh() {
  revalidatePath('/app', 'layout');
}

/**
 * Save the number messages will arrive from.
 *
 * Clearing it also switches the feature off. Leaving `whatsappEnabled` true
 * with no number would be a setting that claims to be on and cannot possibly
 * work — and the reminder sweep would keep selecting the row and skipping it.
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
      data: { phone: null, whatsappEnabled: false },
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

/** Turn capture and reminders on or off. Requires a number to be on file. */
export async function setWhatsappEnabledAction(enabled: boolean): Promise<SettingsState> {
  const { user } = await requireSession();

  const row = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } });
  if (enabled && !row?.phone) {
    return { errors: { enabled: 'צריך לשמור מספר טלפון קודם' } };
  }

  await db.user.update({ where: { id: user.id }, data: { whatsappEnabled: enabled } });
  refresh();
  return { saved: true };
}
