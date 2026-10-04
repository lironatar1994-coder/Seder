import 'server-only';
import nodemailer from 'nodemailer';

export interface Mail { to: string; subject: string; text: string; html?: string }
export interface MailResult { delivered: boolean; provider: 'smtp' | 'resend' | 'preview'; id?: string }
let cached: ReturnType<typeof nodemailer.createTransport> | undefined;

/** Provider acceptance is distinct from a development preview and inbox delivery. */
export async function sendMail(mail: Mail): Promise<MailResult> {
  const from = process.env.MAIL_FROM ?? 'סדר <no-reply@seder.local>';
  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Mail provider rejected message (${response.status})`);
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error('Mail provider returned no message ID');
    console.info(JSON.stringify({ event: 'mail.accepted', provider: 'resend', id: result.id }));
    return { delivered: true, provider: 'resend', id: result.id };
  }
  if (process.env.SMTP_URL) {
    const smtpUrl = new URL(process.env.SMTP_URL);
    smtpUrl.searchParams.set('connectionTimeout', '10000');
    smtpUrl.searchParams.set('greetingTimeout', '10000');
    smtpUrl.searchParams.set('socketTimeout', '15000');
    cached ??= nodemailer.createTransport(smtpUrl.toString());
    const result = await cached.sendMail({ from, ...mail });
    if (!result.accepted?.length || result.rejected?.length) throw new Error('SMTP rejected the recipient');
    console.info(JSON.stringify({ event: 'mail.accepted', provider: 'smtp', id: result.messageId }));
    return { delivered: true, provider: 'smtp', id: result.messageId };
  }
  if (process.env.NODE_ENV === 'production' && process.env.MAIL_PREVIEW !== '1') {
    throw new Error('Email delivery is not configured');
  }
  if (process.env.MAIL_LOG_FILE) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.MAIL_LOG_FILE, `${JSON.stringify(mail)}\n`, 'utf8');
  } else {
    console.info('[Seder mail preview]', mail.text);
  }
  return { delivered: false, provider: 'preview' };
}

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000/seder').replace(/\/$/, '');
}

export function emailHtml(title: string, body: string, link: string, label: string): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  return `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f5f6fa;font-family:Arial,sans-serif;color:#202438"><main style="max-width:520px;margin:32px auto;padding:32px;background:#fff;border-radius:16px"><p style="font-size:26px;font-weight:bold;color:#4b5bd7">סדר</p><h1 style="font-size:24px">${escape(title)}</h1><p style="line-height:1.8">${escape(body)}</p><p style="margin:28px 0"><a href="${escape(link)}" style="display:inline-block;padding:14px 24px;background:#4b5bd7;color:white;text-decoration:none;border-radius:8px">${escape(label)}</a></p><p style="font-size:14px;line-height:1.7">אם הבקשה לא רלוונטית, אפשר להתעלם מההודעה.</p><p dir="ltr" style="font-size:12px;word-break:break-all">${escape(link)}</p></main></body></html>`;
}
