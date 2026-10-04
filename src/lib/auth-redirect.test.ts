import { describe, expect, it } from 'vitest';
import { safeAuthRedirect } from './auth-redirect';

describe('authentication destinations', () => {
  it('preserves invitations and project destinations', () => {
    expect(safeAuthRedirect('/app/join/abc')).toBe('/app/join/abc');
    expect(safeAuthRedirect('/app/project/abc?layout=board')).toBe('/app/project/abc?layout=board');
  });
  it.each(['https://evil.test', '//evil.test/app', '/app/../../evil', '/app\\evil', '/application', '/login', undefined])('rejects unsafe destination %s', (value) => {
    expect(safeAuthRedirect(value)).toBe('/app');
  });
});
