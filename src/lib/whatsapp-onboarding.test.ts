import { describe, expect, it } from 'vitest';
import { shouldIntroduceWhatsapp } from './whatsapp-onboarding';

describe('WhatsApp introduction', () => {
  it('introduces reminders to users without a phone or an opt-in', () => {
    expect(shouldIntroduceWhatsapp({ phone: null, whatsappReminders: false, whatsappIntroSeenAt: null })).toBe(true);
    expect(shouldIntroduceWhatsapp({ phone: '0541234567', whatsappReminders: false, whatsappIntroSeenAt: null })).toBe(true);
  });
  it('respects dismissal and already enabled accounts', () => {
    expect(shouldIntroduceWhatsapp({ phone: null, whatsappReminders: false, whatsappIntroSeenAt: new Date() })).toBe(false);
    expect(shouldIntroduceWhatsapp({ phone: '0541234567', whatsappReminders: true, whatsappIntroSeenAt: null })).toBe(false);
  });
});
