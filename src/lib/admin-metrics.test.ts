import { describe, expect, it } from 'vitest';
import { buildActivityDays, normalizeAdminQuery } from './admin-metrics';
import { accountDestination, isAdministrator, isServiceOperator } from './account-role';
import { safeAuthRedirect } from './auth-redirect';

describe('admin boundaries', () => {
  it('requires a provisioned role; an operator email alone cannot read the dashboard', () => {
    expect(isAdministrator({ role: 'user' })).toBe(false);
    expect(isAdministrator({})).toBe(false);
    expect(isAdministrator({ role: 'administrator' })).toBe(false);
    expect(isAdministrator({ role: 'admin' })).toBe(true);
    expect(isServiceOperator({ role: 'admin', email: 'separate@seder.test' })).toBe(true);
    expect(isServiceOperator({ role: 'user', email: 'person@seder.test' }, 'person@seder.test')).toBe(true);
  });
  it('keeps each account in its intended workspace and prevents external redirects', () => {
    expect(accountDestination({ role: 'admin' }, '/app/join/abc')).toBe('/admin');
    expect(accountDestination({ role: 'user' }, '/admin')).toBe('/app');
    expect(accountDestination({ role: 'user' }, '/app/join/abc')).toBe('/app/join/abc');
    expect(safeAuthRedirect('/admin')).toBe('/admin');
    expect(safeAuthRedirect('/admin/../../evil')).toBe('/app');
    expect(safeAuthRedirect('//evil.test/admin')).toBe('/app');
  });
});

describe('Jerusalem activity data', () => {
  it('buckets UTC evening into the correct local day, including the DST switch', () => {
    const hour = (date: string) => BigInt(Math.floor(new Date(date).getTime() / 3_600_000));
    const days = buildActivityDays([
      { kind: 'created', hour: hour('2026-10-24T21:00:00Z'), count: 2n },
      { kind: 'completed', hour: hour('2026-10-25T22:00:00Z'), count: 3n },
    ], new Date('2026-10-26T10:00:00Z'), 3);
    expect(days.map((day) => [day.key, day.created, day.completed])).toEqual([
      ['2026-10-24', 0, 0], ['2026-10-25', 2, 0], ['2026-10-26', 0, 3],
    ]);
  });
  it('leaves missing days at zero and excludes old data', () => {
    const days = buildActivityDays([{ kind: 'created', hour: 0, count: 500 }], new Date('2026-10-07T08:00:00Z'));
    expect(days).toHaveLength(14);
    expect(days.every((day) => day.created === 0 && day.completed === 0)).toBe(true);
  });
  it('bounds arbitrary search and pagination input', () => {
    expect(normalizeAdminQuery(' a ', '-5')).toEqual({ search: 'a', page: 1 });
    expect(normalizeAdminQuery('x'.repeat(110), '999999')).toEqual({ search: 'x'.repeat(100), page: 100000 });
  });
});
