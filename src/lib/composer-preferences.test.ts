import { describe, expect, it } from 'vitest';
import { COMPOSER_FIELDS, composerPreferencesSchema, readComposerPreferences } from './composer-preferences';

describe('account Quick Add preferences', () => {
  it('keeps all fields visible for existing accounts and malformed stored settings', () => {
    for (const stored of [null, undefined, '', '{bad', '{}', '{"fields":["unknown"],"showLabels":true}']) {
      expect(readComposerPreferences(stored)).toEqual({ fields: [...COMPOSER_FIELDS], showLabels: true });
    }
  });
  it('preserves a custom order, hidden fields and icons-only choice', () => {
    const value = { fields: ['project', 'date', 'labels'], showLabels: false };
    expect(readComposerPreferences(JSON.stringify(value))).toEqual(value);
  });
  it('supports hiding every field while retaining the More menu', () => {
    expect(readComposerPreferences('{"fields":[],"showLabels":false}')).toEqual({ fields: [], showLabels: false });
  });
  it('rejects duplicate fields, unknown keys and invalid types before a write', () => {
    for (const value of [
      { fields: ['date', 'date'], showLabels: true },
      { fields: ['date'], showLabels: 'false' },
      { fields: ['date'], showLabels: true, userId: 'another-account' },
      { fields: ['date'] },
    ]) expect(composerPreferencesSchema.safeParse(value).success).toBe(false);
  });
});
