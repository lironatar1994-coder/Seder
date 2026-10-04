import 'server-only';

import { db } from '@/server/db';
import { envNumber } from '@/lib/env';

/**
 * Cross-user WhatsApp health, for whoever runs the service.
 *
 * The question this exists to answer is "is it failing for anyone?" — which no
 * per-account view can answer, because a user whose messages are silently
 * dropped is exactly the user who never comes to look.
 *
 * It deliberately does **not** carry message bodies. The operator can already
 * read the database, but a page that puts other people's task text on screen is
 * a different thing from one that reports counts and reasons, and only the
 * second is needed to keep the service running.
 */

const WINDOW_HOURS = 24;

export interface WhatsappHealth {
  windowHours: number;
  enabledAccounts: number;
  captured: number;
  /** Inbound from numbers we chose not to act on — unknown, or rate limited. */
  ignoredInbound: number;
  repliesSent: number;
  remindersSent: number;
  outboundFailed: number;
  /** Sends in the window, against the worker's ceiling. */
  sent: number;
  dailyCap: number;
  problems: {
    id: string;
    at: Date;
    kind: string;
    direction: string;
    /** Masked: enough to recognise, not enough to leak in a screenshot. */
    phone: string;
    who: string | null;
    error: string | null;
  }[];
}

/** 0541234567 → 054-•••-4567 */
function mask(local: string): string {
  if (local.length < 10) return local;
  return `${local.slice(0, 3)}-•••-${local.slice(6)}`;
}

export async function readWhatsappHealth(): Promise<WhatsappHealth> {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const [enabledAccounts, grouped, problems] = await Promise.all([
    db.user.count({ where: { whatsappReminders: true, phone: { not: null } } }),
    db.whatsappLog.groupBy({
      by: ['direction', 'kind', 'status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.whatsappLog.findMany({
      where: { createdAt: { gte: since }, status: { in: ['failed', 'ignored'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        kind: true,
        direction: true,
        phone: true,
        error: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const count = (match: { direction?: string; kind?: string; status?: string }) =>
    grouped
      .filter(
        (row) =>
          (match.direction === undefined || row.direction === match.direction) &&
          (match.kind === undefined || row.kind === match.kind) &&
          (match.status === undefined || row.status === match.status),
      )
      .reduce((total, row) => total + row._count._all, 0);

  return {
    windowHours: WINDOW_HOURS,
    enabledAccounts,
    captured: count({ direction: 'IN', kind: 'CAPTURE', status: 'sent' }),
    ignoredInbound: count({ direction: 'IN', status: 'ignored' }),
    repliesSent: count({ direction: 'OUT', kind: 'REPLY', status: 'sent' }),
    remindersSent: count({ direction: 'OUT', kind: 'REMINDER', status: 'sent' }),
    outboundFailed: count({ direction: 'OUT', status: 'failed' }),
    sent: count({ direction: 'OUT', status: 'sent' }),
    // Not `?? 200`: the release writes the key empty when it is unset, and
    // `Number("")` is 0 — which would report a ceiling of zero sends.
    dailyCap: envNumber(process.env.WHATSAPP_DAILY_CAP, 200),
    problems: problems.map((row) => ({
      id: row.id,
      at: row.createdAt,
      kind: row.kind,
      direction: row.direction,
      phone: mask(row.phone),
      who: row.user?.name ?? null,
      error: row.error,
    })),
  };
}
