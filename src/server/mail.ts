import 'server-only';
import nodemailer from 'nodemailer';

/**
 * Outgoing mail.
 *
 * With `SMTP_URL` set, mail is sent for real. Without it — which is the normal
 * state on a laptop — the message is written to the server console instead of
 * being silently dropped, so the reset flow is fully usable in development
 * without anyone signing up for a mail provider.
 *
 *   SMTP_URL="smtp://user:pass@smtp.example.com:587"
 *   MAIL_FROM="סדר <no-reply@example.com>"
 */

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

const FROM = process.env.MAIL_FROM ?? 'סדר <no-reply@seder.local>';

let cached: nodemailer.Transporter | null | undefined;

function transport(): nodemailer.Transporter | null {
  if (cached !== undefined) return cached;
  const url = process.env.SMTP_URL;
  cached = url ? nodemailer.createTransport(url) : null;
  return cached;
}

export async function sendMail(mail: Mail): Promise<void> {
  const smtp = transport();

  // Optional sink for anyone who would rather grep a file than scroll the
  // server log — and how the end-to-end tests read the reset link. Only ever
  // written when the variable is set, and never alongside real SMTP.
  const logFile = process.env.MAIL_LOG_FILE;
  if (!smtp && logFile) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(
      logFile,
      `${JSON.stringify({ to: mail.to, subject: mail.subject, text: mail.text })}\n`,
      'utf8',
    ).catch(() => {});
  }

  if (!smtp) {
    // Deliberately loud: in development this *is* the delivery mechanism, and a
    // quiet no-op would look like a broken feature.
    console.log(
      [
        '',
        '─'.repeat(72),
        '  אין SMTP מוגדר — ההודעה נכתבת לקונסולה במקום להישלח.',
        `  אל:     ${mail.to}`,
        `  נושא:   ${mail.subject}`,
        '',
        mail.text,
        '─'.repeat(72),
        '',
      ].join('\n'),
    );
    return;
  }

  await smtp.sendMail({ from: FROM, to: mail.to, subject: mail.subject, text: mail.text });
}

/** Absolute base URL for links in emails. */
export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
