import 'server-only';

import { readFile } from 'node:fs/promises';

/**
 * What the WhatsApp worker is currently doing.
 *
 * The worker is a separate process, so the web app learns its state from a
 * small file the worker rewrites on every transition. A file rather than a
 * port: there is nothing to keep alive, nothing to authenticate, and reading
 * it cannot block a page render on a socket that is mid-reconnect.
 *
 * The worker writes through a temp file and a rename, so a read either sees
 * the previous state or the next one, never half of either.
 */

export const WHATSAPP_STATUS_FILE =
  process.env.WHATSAPP_STATUS_FILE ?? '/var/lib/seder/whatsapp-status.json';

export type WhatsappStatus =
  | 'INITIALIZING'
  | 'NEEDS_SCAN'
  | 'READY'
  | 'DISCONNECTED'
  | 'LOGGED_OUT'
  | 'ERROR'
  /** No status file at all — the worker has never run on this machine. */
  | 'OFFLINE';

export interface WhatsappState {
  status: WhatsappStatus;
  /** A data: URL for the pairing code, only while status is NEEDS_SCAN. */
  qr: string | null;
  reason: string | null;
  updatedAt: string | null;
  /** True when the worker has not written for a while — the file says READY
   *  but nobody is home. Without this a crashed worker looks connected
   *  forever, which is the most misleading state a dashboard can show. */
  stale: boolean;
}

/** The worker rewrites at least once a minute while it is alive. */
const STALE_AFTER_MS = 5 * 60 * 1000;

export async function readWhatsappState(): Promise<WhatsappState> {
  let raw: string;
  try {
    raw = await readFile(WHATSAPP_STATUS_FILE, 'utf8');
  } catch {
    return { status: 'OFFLINE', qr: null, reason: null, updatedAt: null, stale: false };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WhatsappState>;
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
    const age = updatedAt ? Date.now() - new Date(updatedAt).getTime() : Infinity;

    return {
      status: (parsed.status as WhatsappStatus) ?? 'OFFLINE',
      qr: typeof parsed.qr === 'string' ? parsed.qr : null,
      reason: typeof parsed.reason === 'string' ? parsed.reason : null,
      updatedAt,
      stale: age > STALE_AFTER_MS,
    };
  } catch {
    return { status: 'ERROR', qr: null, reason: 'הקובץ לא קריא', updatedAt: null, stale: true };
  }
}
