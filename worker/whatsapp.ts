/**
 * The WhatsApp process.
 *
 * Runs beside the web app under its own pm2 entry, because a WhatsApp Web
 * socket is a long-lived, QR-paired thing: restarting the site to ship a CSS
 * change must not drop the connection, and a crash here must not take the site
 * down.
 *
 * It creates tasks by calling `captureTask` — the same function the web
 * composer calls, with the same parser. There is no second understanding of
 * "מחר בשעה 14:30" anywhere in this file.
 *
 *   Auth state and the status file live under /var/lib/seder, *outside* the
 *   release directory, because deploying replaces /root/Seder wholesale. Auth
 *   inside the app directory means every deploy silently unpairs the number.
 *
 * Env:
 *   DATABASE_URL              required
 *   WHATSAPP_AUTH_DIR         default /var/lib/seder/whatsapp-auth
 *   WHATSAPP_STATUS_FILE      default /var/lib/seder/whatsapp-status.json
 *   WHATSAPP_REMINDER_LEAD    minutes before a scheduled time (default 15)
 *   WHATSAPP_REMINDER_STALE   minutes after which a reminder is dropped (90)
 *   WHATSAPP_DAILY_CAP        outbound ceiling per rolling day (default 200)
 *   GEMINI_API_KEY            optional; enables the rewrite fallback
 */

import { Boom } from '@hapi/boom';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { toDataURL } from 'qrcode';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { db } from '@/server/db';
import { captureTask } from '@/server/tasks/capture';
import { fromInternational, toInternational } from '@/lib/phone';
import { dayStartInstant, today } from '@/lib/dates';
import {
  captureReply,
  helpMessage,
  needsSecondOpinion,
  readCommand,
  reminderMessage,
} from './reply';
import { toQuickAddLine } from './rewrite';
import { DailyCapReached, SendQueue } from './queue';

const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR ?? '/var/lib/seder/whatsapp-auth';
const STATUS_FILE = process.env.WHATSAPP_STATUS_FILE ?? '/var/lib/seder/whatsapp-status.json';
const LEAD_MINUTES = Number(process.env.WHATSAPP_REMINDER_LEAD ?? 15);
const STALE_MINUTES = Number(process.env.WHATSAPP_REMINDER_STALE ?? 90);
const DAILY_CAP = Number(process.env.WHATSAPP_DAILY_CAP ?? 200);

const SWEEP_MS = 60_000;
/** Per sender, per rolling hour. A person does not send thirty tasks an hour;
 *  something looping does, and every one of them costs a parse and a reply. */
const MAX_PER_HOUR = 30;

const logger = pino({ level: 'silent' });
const queue = new SendQueue({ dailyCap: DAILY_CAP });

let sock: WASocket | null = null;
let connected = false;
let connecting = false;
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let sweeping = false;

/** Recent inbound per phone, for the rate limit. */
const inboundAt = new Map<string, number[]>();
/** The last task each user created here, so "בטל" has something to undo.
 *  In memory on purpose: the window is minutes, and a worker restart
 *  forgetting it is a better outcome than a table that must be pruned. */
const lastCapture = new Map<string, { taskId: string; at: number }>();
const UNDO_WINDOW_MS = 15 * 60 * 1000;

/* -- status ---------------------------------------------------------------- */

type Status = 'INITIALIZING' | 'NEEDS_SCAN' | 'READY' | 'DISCONNECTED' | 'LOGGED_OUT' | 'ERROR';

/**
 * Written for the settings page to read.
 *
 * Through a temp file and a rename, which is atomic on the same filesystem:
 * the reader is a web request that can land mid-write, and half a JSON
 * document renders as "something is broken" rather than "reconnecting".
 */
function setStatus(status: Status, qr: string | null = null, reason?: string): void {
  const payload = JSON.stringify(
    { status, qr, reason: reason ?? null, updatedAt: new Date().toISOString() },
    null,
    2,
  );

  mkdirSync(dirname(STATUS_FILE), { recursive: true });
  const temp = `${STATUS_FILE}.tmp`;
  writeFileSync(temp, payload, { mode: 0o600 });
  renameSync(temp, STATUS_FILE);
  console.log(`[whatsapp] ${status}${reason ? `: ${reason}` : ''}`);
}

/* -- logging --------------------------------------------------------------- */

async function record(entry: {
  userId?: string | null;
  phone: string;
  direction: 'IN' | 'OUT';
  kind: 'CAPTURE' | 'REPLY' | 'REMINDER';
  body: string;
  status: 'sent' | 'failed' | 'ignored';
  error?: string;
}): Promise<void> {
  try {
    await db.whatsappLog.create({
      data: {
        userId: entry.userId ?? null,
        phone: entry.phone,
        direction: entry.direction,
        kind: entry.kind,
        // Bounded: a pasted wall of text should not become a database row the
        // size of the message that produced it.
        body: entry.body.slice(0, 2_000),
        status: entry.status,
        error: entry.error?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    // Logging must never be the thing that breaks sending — the system this
    // replaces lost a whole send cycle to exactly this, every single minute.
    console.error('[whatsapp] could not write the log row:', (error as Error).message);
  }
}

/* -- sending --------------------------------------------------------------- */

/** The JID for a local number, or null when it is not on WhatsApp. */
async function resolveJid(localPhone: string): Promise<string | null> {
  const jid = `${toInternational(localPhone)}@s.whatsapp.net`;
  if (!sock?.onWhatsApp) return jid;

  try {
    const [result] = (await sock.onWhatsApp(jid)) ?? [];
    return result?.exists ? result.jid : null;
  } catch (error) {
    console.error(`[whatsapp] could not resolve ${localPhone}:`, (error as Error).message);
    // Unknown is not "absent" — let the send decide.
    return jid;
  }
}

/** Every outbound message goes through here: paced, capped, and logged. */
async function send(
  localPhone: string,
  text: string,
  meta: { userId?: string | null; kind: 'REPLY' | 'REMINDER' },
): Promise<boolean> {
  if (!sock || !connected) {
    await record({ ...meta, phone: localPhone, direction: 'OUT', body: text, status: 'failed', error: 'not connected' });
    return false;
  }

  try {
    await queue.run(async () => {
      const jid = await resolveJid(localPhone);
      if (!jid) throw new Error('the number is not on WhatsApp');
      await sock!.sendMessage(jid, { text });
    });

    await record({ ...meta, phone: localPhone, direction: 'OUT', body: text, status: 'sent' });
    return true;
  } catch (error) {
    const message = error instanceof DailyCapReached ? error.message : (error as Error).message;
    await record({ ...meta, phone: localPhone, direction: 'OUT', body: text, status: 'failed', error: message });
    console.error(`[whatsapp] send to ${localPhone} failed: ${message}`);
    return false;
  }
}

/* -- inbound --------------------------------------------------------------- */

function textOf(message: Record<string, any> | null | undefined): string {
  const content =
    message?.ephemeralMessage?.message ??
    message?.viewOnceMessage?.message ??
    message?.viewOnceMessageV2?.message ??
    message;

  return String(
    content?.conversation ??
      content?.extendedTextMessage?.text ??
      content?.imageMessage?.caption ??
      content?.videoMessage?.caption ??
      content?.documentMessage?.caption ??
      '',
  ).trim();
}

/** True when this number has said too much in the last hour. */
function overRate(phone: string): boolean {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = (inboundAt.get(phone) ?? []).filter((t) => t > cutoff);
  recent.push(Date.now());
  inboundAt.set(phone, recent);
  return recent.length > MAX_PER_HOUR;
}

async function handleMessage(raw: any): Promise<void> {
  if (!raw?.message || raw.key?.fromMe) return;

  const jid: string | undefined = raw.key?.remoteJid;
  // Groups, status posts and newsletters are not one person's inbox.
  if (!jid || jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid === 'status@broadcast') {
    return;
  }

  const text = textOf(raw.message);
  if (!text) return;

  const phone = fromInternational(jid.split('@')[0]);
  if (!phone) return;

  const user = await db.user.findFirst({
    where: { phone, whatsappEnabled: true },
    select: { id: true },
  });

  // No reply to an unknown number, deliberately: answering would confirm to
  // anyone who guessed the number that an account exists behind it.
  if (!user) {
    await record({ phone, direction: 'IN', kind: 'CAPTURE', body: text, status: 'ignored', error: 'no account with this number' });
    return;
  }

  if (overRate(phone)) {
    await record({ userId: user.id, phone, direction: 'IN', kind: 'CAPTURE', body: text, status: 'ignored', error: 'rate limit' });
    return;
  }

  await record({ userId: user.id, phone, direction: 'IN', kind: 'CAPTURE', body: text, status: 'sent' });

  switch (readCommand(text)) {
    case 'help':
      await send(phone, helpMessage(), { userId: user.id, kind: 'REPLY' });
      return;
    case 'undo':
      await undo(user.id, phone);
      return;
  }

  await capture(user.id, phone, text);
}

async function capture(userId: string, phone: string, text: string): Promise<void> {
  let result = await captureTask(userId, text, {});

  // The parser had nothing to say about timing and the message clearly does.
  // Ask the model to restate it in the app's syntax, then run that through the
  // very same parser — the model never writes a row itself.
  if (needsSecondOpinion(text, result)) {
    const line = await toQuickAddLine(text, new Date());
    if (line) {
      const second = await captureTask(userId, line, {});
      if (second.ok) {
        // The first attempt may have created a task already; the rewrite is
        // the better reading, so the first one goes.
        if (result.ok && result.id) await db.task.delete({ where: { id: result.id } }).catch(() => {});
        result = second;
      }
    }
  }

  if (!result.ok || !result.id) {
    await send(phone, result.error ?? 'לא הצלחתי להבין מה המשימה. אפשר לכתוב "עזרה".', {
      userId,
      kind: 'REPLY',
    });
    return;
  }

  lastCapture.set(userId, { taskId: result.id, at: Date.now() });
  await send(phone, captureReply(result), { userId, kind: 'REPLY' });
}

async function undo(userId: string, phone: string): Promise<void> {
  const last = lastCapture.get(userId);
  if (!last || Date.now() - last.at > UNDO_WINDOW_MS) {
    await send(phone, 'אין משימה אחרונה לבטל.', { userId, kind: 'REPLY' });
    return;
  }

  // Scoped to the owner as well as the id: the map is in memory and the task
  // could have been deleted or moved in the meantime.
  const deleted = await db.task.deleteMany({ where: { id: last.taskId, userId } });
  lastCapture.delete(userId);

  await send(phone, deleted.count ? 'המשימה בוטלה.' : 'אין משימה אחרונה לבטל.', {
    userId,
    kind: 'REPLY',
  });
}

/* -- reminders ------------------------------------------------------------- */

async function sweep(): Promise<void> {
  if (sweeping || !connected) return;
  sweeping = true;

  try {
    const day = today();
    const dayStart = dayStartInstant(day).getTime();
    const now = Date.now();

    const tasks = await db.task.findMany({
      where: {
        status: 'TODO',
        scheduledFor: day,
        scheduledTime: { not: null },
        remindedAt: null,
        parentId: null,
        // Whoever is actually doing it gets the reminder. In an unshared
        // project that is always the author.
        OR: [
          { assigneeId: null, user: { whatsappEnabled: true, phone: { not: null } } },
          { assignee: { whatsappEnabled: true, phone: { not: null } } },
        ],
      },
      select: {
        id: true,
        title: true,
        scheduledTime: true,
        user: { select: { id: true, phone: true, whatsappEnabled: true } },
        assignee: { select: { id: true, phone: true, whatsappEnabled: true } },
      },
      take: 100,
    });

    for (const task of tasks) {
      const person = task.assignee ?? task.user;
      if (!person?.phone || !person.whatsappEnabled) continue;

      const [hours, minutes] = String(task.scheduledTime).split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) continue;

      // Built from the real instant the Israeli day began, not from the
      // server's own midnight — the two differ by the UTC offset, and by an
      // extra hour for half the year.
      const startsAt = dayStart + (hours * 60 + minutes) * 60_000;
      if (now < startsAt - LEAD_MINUTES * 60_000) continue;

      if (now > startsAt + STALE_MINUTES * 60_000) {
        // Too late to be a reminder. Marked so it does not queue up behind
        // every future sweep, and recorded so the silence is explainable.
        await db.task.update({ where: { id: task.id }, data: { remindedAt: new Date() } });
        await record({
          userId: person.id,
          phone: person.phone,
          direction: 'OUT',
          kind: 'REMINDER',
          body: task.title,
          status: 'ignored',
          error: `more than ${STALE_MINUTES} minutes late`,
        });
        continue;
      }

      const sent = await send(person.phone, reminderMessage(task.title, String(task.scheduledTime)), {
        userId: person.id,
        kind: 'REMINDER',
      });

      // Only a delivered reminder is marked. A transient failure retries on
      // the next sweep, and the staleness window above is what stops that
      // from running forever.
      if (sent) {
        await db.task.update({ where: { id: task.id }, data: { remindedAt: new Date() } });
      }
    }
  } catch (error) {
    console.error('[whatsapp] sweep failed:', (error as Error).message);
  } finally {
    sweeping = false;
  }
}

/* -- connection ------------------------------------------------------------ */

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  // Backoff rather than a fixed retry: when WhatsApp is refusing, hammering it
  // every five seconds is how a number earns a longer refusal.
  const delay = Math.min(60_000, 2_000 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delay);
}

async function connect(): Promise<void> {
  if (connecting) return;
  connecting = true;

  try {
    mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      auth: state,
      logger,
      version,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async () => undefined,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        setStatus('NEEDS_SCAN', await toDataURL(qr, { errorCorrectionLevel: 'H' }).catch(() => null));
        return;
      }

      if (connection === 'open') {
        connected = true;
        reconnectAttempt = 0;
        setStatus('READY');
        return;
      }

      if (connection === 'close') {
        connected = false;
        sock = null;

        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const reason = lastDisconnect?.error?.message ?? 'unknown';

        if (code === DisconnectReason.loggedOut) {
          setStatus('LOGGED_OUT', null, reason);
          return; // Only a fresh scan fixes this; retrying cannot.
        }

        setStatus('DISCONNECTED', null, reason);
        scheduleReconnect();
      }
    });

    sock.ev.on('messages.upsert', async ({ type, messages }) => {
      if (type !== 'notify') return;
      for (const message of messages) {
        await handleMessage(message).catch((error) =>
          console.error('[whatsapp] message handler failed:', error),
        );
      }
    });
  } catch (error) {
    connected = false;
    sock = null;
    setStatus('ERROR', null, (error as Error).message);
    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

/* -- lifecycle ------------------------------------------------------------- */

async function shutdown(signal: string): Promise<void> {
  console.log(`[whatsapp] ${signal}, shutting down`);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  try {
    await sock?.end?.(undefined);
    await db.$disconnect();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

setStatus('INITIALIZING');
setInterval(() => void sweep(), SWEEP_MS);
void connect();
