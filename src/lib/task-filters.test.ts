import { describe, expect, it } from 'vitest';
import { filterFromSearch } from './task-filters';
describe('filter links', () => {
  it('reads a preset and applies explicit overrides', () => { expect(filterFromSearch({ preset: 'overdue', priority: '2', query: '  מצגת ' })).toMatchObject({ when: 'overdue', priority: '2', query: 'מצגת' }); });
  it('ignores unrelated routing parameters', () => { expect(filterFromSearch({ id: 'private-filter', random: 'value' }).projectId).toBe(''); });
  it('rejects invalid priority and date scopes', () => { expect(filterFromSearch({ priority: '999', when: 'broken' })).toMatchObject({ priority: 'all', when: 'all' }); });
});
