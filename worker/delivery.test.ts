import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { applyDeliveryReceipt } from './delivery';

const db = new PrismaClient();
const prefix = `receipt-${Date.now()}`;
afterAll(async () => { await db.whatsappLog.deleteMany({ where: { messageId: { startsWith: prefix } } }); await db.$disconnect(); });
async function log(id: string) {
  return db.whatsappLog.create({ data: { phone: '0500000000', direction: 'OUT', kind: 'REMINDER', body: 'test fixture', status: 'sent', messageId: `${prefix}-${id}` } });
}
describe('persisted WhatsApp delivery evidence', () => {
  it('keeps server acceptance distinct from delivery and preserves the first receipt', async () => {
    const row = await log('delivered');
    await applyDeliveryReceipt(db, row.messageId!, 2);
    expect((await db.whatsappLog.findUniqueOrThrow({ where: { id: row.id } })).deliveredAt).toBeNull();
    const at = new Date('2026-10-04T12:00:00Z');
    await applyDeliveryReceipt(db, row.messageId!, 3, at);
    await applyDeliveryReceipt(db, row.messageId!, 4, new Date(at.getTime() + 5000));
    await applyDeliveryReceipt(db, row.messageId!, 3, new Date(at.getTime() + 8000));
    const saved = await db.whatsappLog.findUniqueOrThrow({ where: { id: row.id } });
    expect(saved.deliveredAt).toEqual(at);
    expect(saved.readAt).toEqual(new Date(at.getTime() + 5000));
  });
  it('handles read receipts that precede delivery receipts', async () => {
    const row = await log('read-first');
    await applyDeliveryReceipt(db, row.messageId!, 4);
    const saved = await db.whatsappLog.findUniqueOrThrow({ where: { id: row.id } });
    expect(saved.deliveredAt).not.toBeNull(); expect(saved.readAt).not.toBeNull();
  });
  it('records rejection without changing a confirmed delivered message', async () => {
    const row = await log('rejected'); await applyDeliveryReceipt(db, row.messageId!, 0);
    expect((await db.whatsappLog.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('failed');
    const delivered = await log('no-downgrade'); await applyDeliveryReceipt(db, delivered.messageId!, 3); await applyDeliveryReceipt(db, delivered.messageId!, 0);
    expect((await db.whatsappLog.findUniqueOrThrow({ where: { id: delivered.id } })).status).toBe('sent');
  });
});
