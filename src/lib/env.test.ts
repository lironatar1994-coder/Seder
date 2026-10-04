import { describe, expect, it } from 'vitest';
import { envFlag, envNumber, envText } from './env';

describe('envNumber', () => {
  it('takes a real value', () => {
    expect(envNumber('200', 15)).toBe(200);
    expect(envNumber('0', 15)).toBe(0);
  });

  it('falls back when the variable is absent', () => {
    expect(envNumber(undefined, 15)).toBe(15);
    expect(envNumber(null, 15)).toBe(15);
  });

  it('falls back when it is present but empty', () => {
    // The bug this exists for: the release writes every optional knob whether
    // or not it has a value, so unset arrives as "". `?? 15` skips it, and
    // Number("") is 0 — a daily cap of zero refuses every message in silence.
    expect(envNumber('', 200)).toBe(200);
    expect(envNumber('   ', 200)).toBe(200);
  });

  it('falls back on a typo rather than reading it as zero', () => {
    expect(envNumber('fifteen', 15)).toBe(15);
    expect(envNumber('15m', 15)).toBe(15);
  });

  it('keeps the shape the old code got right', () => {
    expect(envNumber('8', 8)).toBe(8);
    expect(envNumber('-1', 8)).toBe(-1);
  });
});

describe('envFlag', () => {
  it('is on for the usual spellings', () => {
    expect(envFlag('1')).toBe(true);
    expect(envFlag('true')).toBe(true);
    expect(envFlag('TRUE')).toBe(true);
    expect(envFlag('yes')).toBe(true);
  });

  it('is off for everything else, empty included', () => {
    expect(envFlag('')).toBe(false);
    expect(envFlag(undefined)).toBe(false);
    expect(envFlag('0')).toBe(false);
    expect(envFlag('false')).toBe(false);
  });
});

describe('envText', () => {
  it('treats empty as absent', () => {
    expect(envText('')).toBeUndefined();
    expect(envText('  ')).toBeUndefined();
    expect(envText(undefined)).toBeUndefined();
    expect(envText(' a@b.com ')).toBe('a@b.com');
  });
});
