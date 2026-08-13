import { describe, expect, it } from 'vitest';
import { formatPhone, fromInternational, normalizePhone, toInternational } from './phone';

describe('normalizePhone', () => {
  it('keeps a plain local mobile', () => {
    expect(normalizePhone('0541234567')).toBe('0541234567');
  });

  it('strips the separators people type', () => {
    expect(normalizePhone('054-123-4567')).toBe('0541234567');
    expect(normalizePhone('054 123 4567')).toBe('0541234567');
    expect(normalizePhone(' 054.123.4567 ')).toBe('0541234567');
  });

  it('reads the country code in every spelling', () => {
    expect(normalizePhone('+972541234567')).toBe('0541234567');
    expect(normalizePhone('972541234567')).toBe('0541234567');
    expect(normalizePhone('00972541234567')).toBe('0541234567');
    expect(normalizePhone('+972-54-123-4567')).toBe('0541234567');
  });

  it('accepts every live mobile prefix', () => {
    for (const prefix of ['050', '051', '052', '053', '054', '055', '056', '058', '059']) {
      expect(normalizePhone(`${prefix}1234567`)).toBe(`${prefix}1234567`);
    }
  });

  it('refuses a landline — it can neither identify you nor receive from us', () => {
    expect(normalizePhone('031234567')).toBeNull();
    expect(normalizePhone('09-123-4567')).toBeNull();
    expect(normalizePhone('+97231234567')).toBeNull();
  });

  it('refuses the wrong length', () => {
    expect(normalizePhone('05412345')).toBeNull();
    expect(normalizePhone('05412345678')).toBeNull();
  });

  it('refuses nothing at all', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('לא מספר')).toBeNull();
  });
});

describe('round trip', () => {
  it('goes out to WhatsApp and comes back the same', () => {
    const stored = '0541234567';
    const wire = toInternational(stored);
    expect(wire).toBe('972541234567');
    expect(fromInternational(wire)).toBe(stored);
  });
});

describe('formatPhone', () => {
  it('groups it the way an Israeli reads it', () => {
    expect(formatPhone('0541234567')).toBe('054-123-4567');
  });
});
