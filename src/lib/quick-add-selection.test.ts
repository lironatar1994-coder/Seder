import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quick-add-parser';
import { quickAddSchedule, quickAddSelectionSchema, reconcileQuickAddSelection, withoutQuickAddTokens } from './quick-add-selection';

const now = new Date('2026-10-04T10:00:00Z');
const parse = (text: string) => parseQuickAdd(text, now, { projects: ['טיול משפחתי'] });

describe('quick-add picker and sentence precedence', () => {
  it('previews the actual Today and calendar defaults before typing', () => {
    expect(quickAddSchedule(parse(''), { view: 'today' }, {}, now).date).toBe('2026-10-04');
    expect(quickAddSchedule(parse(''), { defaultDate: '2026-10-20' }, {}, now).date).toBe('2026-10-20');
  });
  it('an explicit clear overrides Today and calendar defaults', () => {
    const selection = { schedule: { bucket: 'ANYTIME' as const, date: null, time: null } };
    expect(quickAddSchedule(parse('משימה'), { view: 'today', defaultDate: '2026-10-20' }, selection, now)).toEqual({ bucket: 'ANYTIME', date: null, time: null });
    expect(quickAddSchedule(parse('משימה בכל עת'), { view: 'today' }, {}, now).date).toBeNull();
  });
  it('a typed date overrides the view default', () => {
    expect(quickAddSchedule(parse('מצגת מחר בשעה 14:30'), { defaultDate: '2026-10-20' }, {}, now)).toEqual({ bucket: 'SCHEDULED', date: '2026-10-05', time: '14:30' });
  });
  it('a typed time keeps the day chosen in the picker', () => {
    const selection = { schedule: { bucket: 'SCHEDULED' as const, date: '2026-10-20', time: null } };
    const next = reconcileQuickAddSelection(parse('מצגת'), parse('מצגת בשעה 17:15'), selection);
    expect(quickAddSchedule(parse('מצגת בשעה 17:15'), {}, next, now)).toEqual({ bucket: 'SCHEDULED', date: '2026-10-20', time: '17:15' });
  });
  it('a typed day keeps the hour chosen in the picker', () => {
    const selection = { schedule: { bucket: 'SCHEDULED' as const, date: '2026-10-20', time: '17:15' } };
    const next = reconcileQuickAddSelection(parse('מצגת'), parse('מצגת מחר'), selection);
    expect(quickAddSchedule(parse('מצגת מחר'), {}, next, now)).toEqual({ bucket: 'SCHEDULED', date: '2026-10-05', time: '17:15' });
  });
  it('deleting a typed hour does not leave a stale time or lose the selected day', () => {
    const selection = { schedule: { bucket: 'SCHEDULED' as const, date: '2026-10-20', time: null } };
    const typed = reconcileQuickAddSelection(parse('מצגת'), parse('מצגת בשעה 17:15'), selection);
    const cleared = reconcileQuickAddSelection(parse('מצגת בשעה 17:15'), parse('מצגת'), typed);
    expect(quickAddSchedule(parse('מצגת'), {}, cleared, now)).toEqual({ bucket: 'SCHEDULED', date: '2026-10-20', time: null });
  });
  it('ordinary title editing preserves choices, while new typed attributes take over', () => {
    const selection = { projectId: 'clx123456789123456789123456', priority: 2 as const, deadline: '2026-10-30' };
    expect(reconcileQuickAddSelection(parse('מצגת'), parse('מצגת לצוות'), selection)).toEqual(selection);
    expect(reconcileQuickAddSelection(parse('מצגת'), parse('מצגת #טיול משפחתי !1 עד מחר'), selection)).toEqual({});
  });
  it('changing one field removes all of its tokens and preserves the others and title', () => {
    const text = 'מצגת מחר בשעה 14:30 היום #טיול משפחתי !1 עד מחר @טלפון';
    expect(withoutQuickAddTokens(text, parse(text), ['date', 'time', 'bucket'])).toBe('מצגת #טיול משפחתי !1 עד מחר @טלפון');
    expect(withoutQuickAddTokens(text, parse(text), ['project'])).toBe('מצגת מחר בשעה 14:30 היום !1 עד מחר @טלפון');
  });
  it('starts a picker-selected recurrence from the calendar day', () => {
    expect(quickAddSchedule(parse('מצגת'), { defaultDate: '2026-10-20' }, { recurrence: 'weekly:1:1' }, now).date).toBe('2026-10-26');
  });
  it('rejects malformed dates, missing schedule days, times and foreign-shaped project ids', () => {
    for (const selection of [
      { schedule: { bucket: 'SCHEDULED', date: '2026-02-30' } },
      { schedule: { bucket: 'SCHEDULED', date: null } },
      { schedule: { bucket: 'SCHEDULED', date: '2026-10-04', time: '24:00' } },
      { deadline: '2026-02-30' }, { projectId: 'unsafe-id' }, { priority: 0 },
      { labelNames: ['לא תקין'] }, { recurrence: 'invalid-rule' },
    ]) expect(quickAddSelectionSchema.safeParse(selection).success).toBe(false);
  });
});
