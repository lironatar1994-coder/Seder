import { afterEach, describe, expect, it, vi } from 'vitest';
import { openToken, sealToken, hashState } from './crypto';
afterEach(() => vi.unstubAllEnvs());
describe('Google token storage', () => {
  it('encrypts with a fresh IV and round-trips the value', () => {
    vi.stubEnv('GOOGLE_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
    const value = sealToken('private-refresh-token'); expect(value).not.toContain('private-refresh-token'); expect(value).not.toBe(sealToken('private-refresh-token')); expect(openToken(value)).toBe('private-refresh-token');
  });
  it('refuses a changed ciphertext or wrong key', () => {
    vi.stubEnv('GOOGLE_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
    const token = sealToken('secret'); const parts = token.split('.'); parts[3] = Buffer.from('tampered').toString('base64url'); expect(() => openToken(parts.join('.'))).toThrow();
    vi.stubEnv('GOOGLE_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 8).toString('base64')); expect(() => openToken(token)).toThrow();
  });
  it('fails closed when encryption is not configured', () => { vi.stubEnv('GOOGLE_TOKEN_ENCRYPTION_KEY', ''); expect(() => sealToken('secret')).toThrow('GOOGLE_CONFIG_MISSING'); });
  it('stores a hash instead of the bearer state', () => { expect(hashState('state')).toMatch(/^[a-f0-9]{64}$/); expect(hashState('state')).not.toContain('state'); });
});
