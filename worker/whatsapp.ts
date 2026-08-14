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
  jidNormalizedUser,
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
  morningMessage,
  needsSecondOpinion,
  readCommand,
  reminderMessage,
} from './reply';
import { toQuickAddLine } from './rewrite';
import { decideAt, morningInstant, morningIsDue } from './schedule';
import { reminderFireAt } from '@/lib/reminder';
import { timedDueWhere, untimedDueWhere } from '@/server/tasks/reminders';
import { DailyCapReached, SendQueue } from './queue';
import { Alerts } from './alerts';
import { envFlag, envNumber, envText } from '@/lib/env';
import { sendMail, appUrl } from '@/server/mail';

const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR ?? '/var/lib/seder/whatsapp-auth';
const STATUS_FILE = process.env.WHATSAPP_STATUS_FILE ?? '/var/lib/seder/whatsapp-status.json';
const LEAD_MINUTES = envNumber(process.env.WHATSAPP_REMINDER_LEAD, 15);
const STALE_MINUTES = envNumber(process.env.WHATSAPP_REMINDER_STALE, 90);
/** When a task has a date but no time, this is the hour it is worth a nudge. */
const MORNING_HOUR = envNumber(process.env.WHATSAPP_MORNING_HOUR, 8);
/** How long after that hour the morning note may still go out, so a worker
 *  that was down at 08:00 still sends it rather than skipping the day. */
const MORNING_GRACE_MINUTES = envNumber(process.env.WHATSAPP_MORNING_GRACE, 180);
const DAILY_CAP = envNumber(process.env.WHATSAPP_DAILY_CAP, 200);

const DEBUG = envFlag(process.env.WHATSAPP_DEBUG);

/**
 * How recent an `append` message must be to be acted on.
 *
 * `notify` is WhatsApp telling us something just happened. `append` is the
 * same channel history sync arrives on, so acting on it unconditionally risks
 * replaying an old conversation into somebody's Inbox as tasks. A message the
 * operator typed on their phone a moment ago is well inside this; a chat from
 * last March is not.
 */
const APPEND_FRESHNESS_MS = 15 * 60_000;

const SWEEP_MS = 60_000;
/**
 * How often the status file is rewritten with no change to report.
 *
 * Without this the file is only touched on a transition, so a worker that
 * connected an hour ago and has been fine ever since looks exactly like one
 * that connected an hour ago and died — both leave a READY file with an old
 * timestamp. The reader treats a stale timestamp as "not responding", so the
 * heartbeat is what makes that judgement mean anything.
 */
const HEARTBEAT_MS = 60_000;
/** Per sender, per rolling hour. A person does not send thirty tasks an hour;
 *  something looping does, and every one of them costs a parse and a reply. */
const MAX_PER_HOUR = 30;

const logger = pino({ level: 'silent' });
const queue = new SendQueue({ dailyCap: DAILY_CAP });

/** Where operational alerts go. Without it, they are logged and nothing else. */
const ADMIN_EMAIL = envText(process.env.SEDER_ADMIN_EMAIL);
/** How long the socket may be down before it stops being ordinary churn.
 *  It reconnects within seconds several times an hour; only a real outage
 *  should reach anybody's inbox. */
const OUTAGE_MINUTES = envNumber(process.env.WHATSAPP_OUTAGE_MINUTES, 10);

const alerts = new Alerts(async ({ subject, text }) => {
  console.log(`[whatsapp] ALERT ${subject}`);
  if (!ADMIN_EMAIL) return;
  await sendMail({
    to: ADMIN_EMAIL,
    subject,
    text: `${text}\n\n${appUrl()}/app/settings/whatsapp`,
  });
});

/** When the socket last went down, or null while it is up. */
let downSince: number | null = null;

let sock: WASocket | null = null;
let connected = false;
let connecting = false;
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let sweeping = false;

/** Recent inbound per phone, for the rate limit. */
const inboundAt = new Map<string, number[]>();

/**
 * Ids of messages this worker sent.
 *
 * Only needed because of the note-to-self chat: there, our own reply comes
 * straight back through `messages.upsert` looking exactly like a new message
 * from the operator. Without this the reply becomes a task, which produces a
 * reply, which becomes a task. Bounded, because the loop it prevents would
 * otherwise be prevented by memory exhaustion.
 */
const sentIds = new Set<string>();
const SENT_MEMORY = 200;

function rememberSent(id: string | null | undefined): void {
  if (!id) return;
  sentIds.add(id);
  if (sentIds.size > SENT_MEMORY) {
    // Insertion-ordered, so the first key is the oldest.
    sentIds.delete(sentIds.values().next().value as string);
  }
}
/** The last task each user created here, so "בטל" has something to undo.
 *  In memory on purpose: the window is minutes, and a worker restart
 *  forgetting it is a better outcome than a table that must be pruned. */
const lastCapture = new Map<string, { taskId: string; at: number }>();
const UNDO_WINDOW_MS = 15 * 60 * 1000;

/* -- status ---------------------------------------------------------------- */

type Status = 'INITIALIZING' | 'NEEDS_SCAN' | 'READY' | 'DISCONNECTED' | 'LOGGED_OUT' | 'ERROR';

/** The last thing written, so the heartbeat can restate it. */
let current: { status: Status; qr: string | null; reason?: string } = {
  status: 'INITIALIZING',
  qr: null,
};

/**
 * Written for the settings page to read.
 *
 * Through a temp file and a rename, which is atomic on the same filesystem:
 * the reader is a web request that can land mid-write, and half a JSON
 * document renders as "something is broken" rather than "reconnecting".
 */
function setStatus(status: Status, qr: string | null = null, reason?: string): void {
  current = { status, qr, reason };
  writeStatus();
  console.log(`[whatsapp] ${status}${reason ? `: ${reason}` : ''}`);
}

/** Rewrites the file with whatever the state already is, refreshing the
 *  timestamp. Silent: a heartbeat that logged would fill the log with itself. */
function writeStatus(): void {
  const payload = JSON.stringify(
    {
      status: current.status,
      qr: current.qr,
      reason: current.reason ?? null,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  mkdirSync(dirname(STATUS_FILE), { recursive: true });
  const temp = `${STATUS_FILE}.tmp`;
  writeFileSync(temp, payload, { mode: 0o600 });
  renameSync(temp, STATUS_FILE);
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
      const receipt = await sock!.sendMessage(jid, { text });
      rememberSent(receipt?.key?.id);
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

/** Is this the paired account's own chat with itself? */
function isNoteToSelf(jid: string): boolean {
  const me = sock?.user?.id ? jidNormalizedUser(sock.user.id) : null;
  const lid = sock?.user?.lid ? jidNormalizedUser(sock.user.lid) : null;
  const normalized = jidNormalizedUser(jid);
  return normalized === me || (lid !== null && normalized === lid);
}

/**
 * Returns why the message was not acted on, or null when it was.
 *
 * Every one of these paths used to be a bare `return`, which is why the first
 * failed attempt at this feature left no trace anywhere: no log row, no output,
 * nothing to look at. A reason string costs nothing and turns "it didn't work"
 * into a sentence.
 */
async function handleMessage(raw: any): Promise<string | null> {
  if (!raw?.message) {
    // WhatsApp sometimes hands over an envelope with nothing decrypted in it.
    // Naming what *did* arrive is the difference between another round trip
    // and knowing which case this is.
    return (
      `no message content (fields=${Object.keys(raw ?? {}).join('|')}` +
      ` stub=${raw?.messageStubType ?? 'none'}` +
      ` params=${JSON.stringify(raw?.messageStubParameters ?? [])}` +
      ` fromMe=${raw?.key?.fromMe} jid=${raw?.key?.remoteJid})`
    );
  }

  const jid: string | undefined = raw.key?.remoteJid;
  // Groups, status posts and newsletters are not one person's inbox.
  if (!jid || jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid === 'status@broadcast') {
    return `not a personal chat (${jid ?? 'no jid'})`;
  }

  /**
   * "Message yourself" is a real inbox, and for whoever runs the service it is
   * the *only* way in: the paired number and their own number are the same
   * phone, so every message they send it is technically one they sent.
   *
   * `fromMe` therefore cannot mean "ignore". It means "ignore unless this is
   * the self-chat" — and separately, ignore anything we sent ourselves, which
   * in that chat comes straight back looking like a fresh message.
   */
  if (raw.key?.fromMe && !isNoteToSelf(jid)) return `sent by me to someone else (${jid})`;
  if (sentIds.has(String(raw.key?.id))) return 'our own reply, coming back';

  const text = textOf(raw.message);
  if (!text) return `no text (${Object.keys(raw.message).join(',')})`;

  const phone = fromInternational(jid.split('@')[0]);
  if (!phone) return `not an Israeli mobile (${jid})`;

  const user = await db.user.findFirst({
    where: { phone, whatsappCapture: true },
    select: { id: true },
  });

  // No reply to an unknown number, deliberately: answering would confirm to
  // anyone who guessed the number that an account exists behind it.
  if (!user) {
    await record({ phone, direction: 'IN', kind: 'CAPTURE', body: text, status: 'ignored', error: 'no account with this number' });
    return `no account for ${phone}`;
  }

  if (overRate(phone)) {
    await record({ userId: user.id, phone, direction: 'IN', kind: 'CAPTURE', body: text, status: 'ignored', error: 'rate limit' });
    return 'rate limited';
  }

  await record({ userId: user.id, phone, direction: 'IN', kind: 'CAPTURE', body: text, status: 'sent' });

  switch (readCommand(text)) {
    case 'help':
      await send(phone, helpMessage(), { userId: user.id, kind: 'REPLY' });
      return null;
    case 'undo':
      await undo(user.id, phone);
      return null;
  }

  await capture(user.id, phone, text);
  return null;
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
      where: timedDueWhere(day),
      select: {
        id: true,
        title: true,
        scheduledFor: true,
        scheduledTime: true,
        reminder: true,
        user: { select: { id: true, phone: true, whatsappReminders: true, reminderHour: true } },
        assignee: {
          select: { id: true, phone: true, whatsappReminders: true, reminderHour: true },
        },
      },
      take: 100,
    });

    for (const task of tasks) {
      const person = task.assignee ?? task.user;
      if (!person?.phone || !person.whatsappReminders) continue;

      /* The lead is the task's own when it has one, and the account default
         otherwise — so "an hour before" on one task does not quietly become
         fifteen minutes because that is what everything else uses. */
      const fireAt = reminderFireAt({
        scheduledFor: task.scheduledFor,
        scheduledTime: task.scheduledTime,
        reminder: task.reminder,
        reminderHour: person.reminderHour,
        defaultLead: LEAD_MINUTES,
      });
      if (!fireAt) continue;

      const verdict = decideAt({ now, fireAt: fireAt.getTime(), staleMinutes: STALE_MINUTES });

      if (verdict === 'wait') continue;

      if (verdict === 'stale') {
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

    await sweepMorning(day, dayStart, now);
  } catch (error) {
    console.error('[whatsapp] sweep failed:', (error as Error).message);
  } finally {
    sweeping = false;
  }
}

/**
 * The morning note about today's dated-but-untimed tasks.
 *
 * One message per person listing all of them, rather than one message per
 * task: "today" is not a moment worth interrupting for the way "14:30" is, and
 * eight separate pings at 08:00 is how a person mutes the number.
 *
 * Only tasks that already existed at 08:00 are included. Something added at
 * 09:30 for today does not need to be announced back to the person who just
 * typed it, and without that rule every afternoon addition would ping
 * instantly, since the morning hour is already behind us.
 */
async function sweepMorning(day: Date, dayStart: number, now: number): Promise<void> {
  /* Every candidate for the day, then filtered per person: the hour is an
     account setting now, so "is the morning note due?" has a different answer
     for each recipient and cannot be asked once up front. */
  const tasks = await db.task.findMany({
    where: untimedDueWhere(day),
    select: {
      id: true,
      title: true,
      createdAt: true,
      user: { select: { id: true, phone: true, whatsappReminders: true, reminderHour: true } },
      assignee: { select: { id: true, phone: true, whatsappReminders: true, reminderHour: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 400,
  });

  // Grouped by whoever is doing them, not by who wrote them.
  const byPerson = new Map<
    string,
    { phone: string; hour: number; ids: string[]; titles: string[] }
  >();

  for (const task of tasks) {
    const person = task.assignee ?? task.user;
    if (!person?.phone || !person.whatsappReminders) continue;

    /* Only what already existed at their morning hour. A task added at 15:00
       for today does not need announcing back to the person who just typed
       it, and without this every afternoon addition would ping immediately —
       the hour is already behind us by then. */
    if (task.createdAt.getTime() >= morningInstant(dayStart, person.reminderHour)) continue;

    const bucket = byPerson.get(person.id) ?? {
      phone: person.phone,
      hour: person.reminderHour,
      ids: [],
      titles: [],
    };
    bucket.ids.push(task.id);
    bucket.titles.push(task.title);
    byPerson.set(person.id, bucket);
  }

  for (const [userId, bucket] of byPerson) {
    if (
      !morningIsDue({ now, dayStart, hour: bucket.hour, graceMinutes: MORNING_GRACE_MINUTES })
    ) {
      continue;
    }

    const sent = await send(bucket.phone, morningMessage(bucket.titles), {
      userId,
      kind: 'REMINDER',
    });

    // All of them, or none: they went out in one message, so marking only some
    // would repeat the whole list tomorrow minus a few.
    if (sent) {
      await db.task.updateMany({
        where: { id: { in: bucket.ids } },
        data: { remindedAt: new Date() },
      });
    }
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
        downSince = null;
        setStatus('READY');
        void alerts.resolve('offline', {
          subject: 'סדר · וואטסאפ חזר',
          text: 'החיבור לוואטסאפ פעיל שוב. משימות שנשלחו בזמן הנתק לא נקלטו.',
        });
        void alerts.resolve('logged-out', {
          subject: 'סדר · וואטסאפ חובר מחדש',
          text: 'המכשיר חובר מחדש והשירות פעיל.',
        });
        if (DEBUG) {
          // Which identities count as "me" — the comparison the self-chat
          // depends on, and the one thing that cannot be checked from outside.
          console.log(`[whatsapp] id=${sock?.user?.id} lid=${sock?.user?.lid ?? 'none'}`);
        }
        return;
      }

      if (connection === 'close') {
        connected = false;
        sock = null;

        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const reason = lastDisconnect?.error?.message ?? 'unknown';

        if (code === DisconnectReason.loggedOut) {
          setStatus('LOGGED_OUT', null, reason);
          // The one failure nobody notices: capture simply stops, and no
          // amount of retrying fixes it. Straight out, no waiting period.
          void alerts.raise('logged-out', {
            subject: 'סדר · וואטסאפ נותק וצריך סריקה מחדש',
            text: `החיבור לוואטסאפ נותק (${reason}). עד לסריקת קוד חדש בהגדרות, הודעות נכנסות לא ייקלטו ותזכורות לא יישלחו.`,
          });
          return; // Only a fresh scan fixes this; retrying cannot.
        }

        setStatus('DISCONNECTED', null, reason);
        downSince ??= Date.now();
        scheduleReconnect();
      }
    });

    sock.ev.on('messages.upsert', async ({ type, messages }) => {
      for (const message of messages) {
        /* `notify` is WhatsApp saying this just happened. A message the
           operator types on their own phone reaches us as `append` instead —
           it is a sync from another of their linked devices, not a
           notification — and dropping every `append` is what made the first
           self-chat test vanish without a trace.

           `append` is also the channel history sync arrives on, so it is
           accepted only while it is fresh. An old conversation replaying into
           somebody's Inbox as tasks is a much worse failure than a missed
           message. */
        if (type !== 'notify') {
          const sentAt = Number(message.messageTimestamp ?? 0) * 1000;
          const age = Date.now() - sentAt;
          if (!sentAt || age > APPEND_FRESHNESS_MS) {
            if (DEBUG) console.log(`[whatsapp] skip ${type}: ${Math.round(age / 1000)}s old`);
            continue;
          }
        }

        const skipped = await handleMessage(message).catch((error) => {
          console.error('[whatsapp] message handler failed:', error);
          return 'handler threw';
        });

        if (skipped && DEBUG) console.log(`[whatsapp] skip (${type}): ${skipped}`);
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
// Proof of life, whatever the state. A stale file now means a stopped process.
setInterval(writeStatus, HEARTBEAT_MS);

// A drop that lasts is an outage; a drop that heals in four seconds is Tuesday.
setInterval(() => {
  if (downSince === null || connected) return;
  if (Date.now() - downSince < OUTAGE_MINUTES * 60_000) return;

  void alerts.raise('offline', {
    subject: 'סדר · וואטסאפ מנותק',
    text: `החיבור מנותק כבר יותר מ־${OUTAGE_MINUTES} דקות והניסיונות להתחבר מחדש נכשלים. הודעות נכנסות לא נקלטות בינתיים.`,
  });
}, HEARTBEAT_MS);
void connect();
