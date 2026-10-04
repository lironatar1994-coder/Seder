import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { smtpSend, createTransport } = vi.hoisted(() => { const smtpSend = vi.fn(); return { smtpSend, createTransport: vi.fn(() => ({ sendMail: smtpSend })) }; });
vi.mock('nodemailer', () => ({ default: { createTransport } }));

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv('RESEND_API_KEY', ''); vi.stubEnv('SMTP_URL', ''); vi.stubEnv('MAIL_LOG_FILE', ''); vi.stubEnv('MAIL_PREVIEW', ''); vi.stubEnv('NODE_ENV', 'production'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const mail = { to: 'tester@example.test', subject: 'איפוס', text: 'קישור' };
describe('real email delivery', () => {
  it('fails closed in production when delivery is missing', async () => { const { sendMail } = await import('./mail'); await expect(sendMail(mail)).rejects.toThrow('not configured'); });
  it('does not report a preview as delivered', async () => { vi.stubEnv('MAIL_PREVIEW', '1'); vi.spyOn(console, 'info').mockImplementation(() => {}); const { sendMail } = await import('./mail'); expect(await sendMail(mail)).toEqual({ delivered: false, provider: 'preview' }); });
  it('checks SMTP recipient acceptance', async () => { vi.stubEnv('SMTP_URL', 'smtp://localhost:1025'); smtpSend.mockResolvedValue({ accepted: [], rejected: [mail.to] }); const { sendMail } = await import('./mail'); await expect(sendMail(mail)).rejects.toThrow('rejected'); });
  it('requires a successful Resend response and message ID', async () => { vi.stubEnv('RESEND_API_KEY', 'test-key'); const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'provider-message' }), { status: 200 })); vi.stubGlobal('fetch', request); const { sendMail } = await import('./mail'); expect(await sendMail(mail)).toEqual({ delivered: true, provider: 'resend', id: 'provider-message' }); expect(request.mock.calls[0][0]).toBe('https://api.resend.com/emails'); });
  it('rejects provider errors and missing IDs', async () => { vi.stubEnv('RESEND_API_KEY', 'test-key'); const request = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 403 })).mockResolvedValueOnce(new Response('{}', { status: 200 })); vi.stubGlobal('fetch', request); const { sendMail } = await import('./mail'); await expect(sendMail(mail)).rejects.toThrow('403'); await expect(sendMail(mail)).rejects.toThrow('no message ID'); });
  it('escapes user content in email HTML', async () => { const { emailHtml } = await import('./mail'); const html = emailHtml('<script>', 'Tom & Jane', 'https://example.test?a=1&b=2', 'הצטרפות'); expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('dir="rtl"'); });
});
