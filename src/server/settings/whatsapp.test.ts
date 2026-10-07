import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { markWhatsappIntroductionSeenAction, requestWhatsappPairingAction, sendWhatsappTestAction } from './whatsapp';
import { join } from 'node:path';
const mocks = vi.hoisted(() => ({
  session: { user: { id: 'my-account', email: 'operator@seder.test', role: 'user' } },
  updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), count: vi.fn(), write: vi.fn(), link: vi.fn(), unlink: vi.fn(), state: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../auth/session', () => ({ requireSession: async () => mocks.session }));
vi.mock('../db', () => ({ db: { user: { updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow }, whatsappLog: { count: mocks.count } } }));
vi.mock('../whatsapp/status', () => ({ readWhatsappState: mocks.state, WHATSAPP_STATUS_FILE: '/var/lib/seder/whatsapp-status.json' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('node:fs/promises', () => ({ writeFile: mocks.write, link: mocks.link, unlink: mocks.unlink }));
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('SEDER_ADMIN_EMAIL', 'operator@seder.test');
  mocks.session.user.email = 'operator@seder.test';
  mocks.session.user.role = 'user';
  mocks.state.mockResolvedValue({ status: 'READY', stale: false });
  mocks.findUniqueOrThrow.mockResolvedValue({ phone: '0541234567', whatsappReminders: true });
  mocks.count.mockResolvedValue(0); mocks.write.mockResolvedValue(undefined);
  mocks.link.mockResolvedValue(undefined); mocks.unlink.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe('WhatsApp operator and user boundaries', () => {
  it('rejects pairing and test requests from another signed-in account', async () => {
    mocks.session.user.email = 'other@seder.test';
    expect((await requestWhatsappPairingAction()).errors).toBeDefined();
    expect((await sendWhatsappTestAction()).errors).toBeDefined();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('keeps a connected service paired', async () => {
    expect((await requestWhatsappPairingAction()).errors).toBeDefined(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it('creates a short-lived pairing request for a logged-out operator', async () => {
    mocks.state.mockResolvedValue({ status: 'LOGGED_OUT', stale: false });
    expect(await requestWhatsappPairingAction()).toEqual({ saved: true });
    expect(mocks.link).toHaveBeenCalledWith(expect.stringContaining('whatsapp-pairing-request.json.'), join('/var/lib/seder', 'whatsapp-pairing-request.json'));
    expect(mocks.write).toHaveBeenCalledWith(expect.stringContaining('whatsapp-pairing-request.json.'), expect.any(String), { mode: 0o600, flag: 'wx' });
  });
  it('allows the dedicated administrator to pair without replacing the existing operator email', async () => {
    mocks.session.user.email = 'dedicated-admin@seder.test';
    mocks.session.user.role = 'admin';
    mocks.state.mockResolvedValue({ status: 'LOGGED_OUT', stale: false });
    expect(await requestWhatsappPairingAction()).toEqual({ saved: true });
    expect(mocks.write).toHaveBeenCalled();
  });
  it('cannot test before opt-in or while disconnected', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ phone: '0541234567', whatsappReminders: false });
    expect((await sendWhatsappTestAction()).errors).toBeDefined();
    mocks.findUniqueOrThrow.mockResolvedValue({ phone: '0541234567', whatsappReminders: true }); mocks.state.mockResolvedValue({ status: 'LOGGED_OUT', stale: false });
    expect((await sendWhatsappTestAction()).errors).toBeDefined(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it('queues a test only for the authenticated operator and limits repeats', async () => {
    expect(await sendWhatsappTestAction()).toEqual({ saved: true });
    expect(JSON.parse(mocks.write.mock.calls[0][1]).userId).toBe('my-account');
    mocks.write.mockClear(); mocks.count.mockResolvedValue(1);
    expect((await sendWhatsappTestAction()).errors).toBeDefined(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it('marks only this account`s introduction seen without enabling messages', async () => {
    await markWhatsappIntroductionSeenAction();
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: 'my-account', whatsappIntroSeenAt: null }, data: { whatsappIntroSeenAt: expect.any(Date) } });
  });
});
