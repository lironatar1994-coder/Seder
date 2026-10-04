import type { PrismaClient } from '@prisma/client';

/** Baileys: ERROR=0, SERVER_ACK=2, DELIVERY_ACK=3, READ=4, PLAYED=5. */
export async function applyDeliveryReceipt(db: PrismaClient, messageId: string, status: number, at = new Date()): Promise<void> {
  if (status === 0) {
    await db.whatsappLog.updateMany({ where: { messageId, deliveredAt: null }, data: { status: 'failed', error: 'WhatsApp rejected the message' } });
    return;
  }
  if (status < 3) return;
  await db.whatsappLog.updateMany({ where: { messageId, deliveredAt: null }, data: { deliveredAt: at, status: 'sent', error: null } });
  if (status >= 4) await db.whatsappLog.updateMany({ where: { messageId, readAt: null }, data: { readAt: at } });
}
