import { describe, expect, it } from 'vitest';
import { describeTaskFilter, filterFromSearch, isFilterResultSearch } from './task-filters';
describe('filter links', () => {
  it('reads a preset and applies explicit overrides', () => { expect(filterFromSearch({ preset: 'overdue', priority: '2', query: '  מצגת ' })).toMatchObject({ when: 'overdue', priority: '2', query: 'מצגת' }); });
  it('ignores unrelated routing parameters', () => { expect(filterFromSearch({ id: 'private-filter', random: 'value' }).projectId).toBe(''); });
  it('rejects invalid priority and date scopes', () => { expect(filterFromSearch({ priority: '999', when: 'broken' })).toMatchObject({ priority: 'all', when: 'all' }); });
  it('keeps directory navigation separate from an explicitly applied empty filter', () => {
    expect(isFilterResultSearch({})).toBe(false);
    expect(isFilterResultSearch({ searchTask: 'task-id' })).toBe(false);
    expect(isFilterResultSearch({ applied: '1' })).toBe(true);
    expect(isFilterResultSearch({ preset: 'overdue' })).toBe(true);
    expect(isFilterResultSearch({ id: 'saved-id' })).toBe(true);
    expect(isFilterResultSearch({ priority: '1' })).toBe(true);
  });
  it('describes every criterion and resolves project names without exposing identifiers', () => {
    const filter = filterFromSearch({ query: 'מצגת', priority: '2', when: 'undated', projectId: 'private-id', assignee: 'me', scope: 'shared' });
    expect(describeTaskFilter(filter, [{ id: 'private-id', name: 'עבודה' }])).toEqual(['חיפוש: מצגת', 'עדיפות: חשוב', 'ללא תאריך מתוכנן', 'פרויקט: עבודה', 'באחריותי', 'פרויקטים משותפים']);
    expect(describeTaskFilter(filter, [])).toContain('פרויקט: לא זמין');
    expect(describeTaskFilter(filterFromSearch({}), [])).toEqual(['כל המשימות הפתוחות']);
  });
});
