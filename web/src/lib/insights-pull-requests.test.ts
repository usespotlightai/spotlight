import { describe, expect, it } from 'vitest';
import {
  formatPullRequestFilterValue,
  groupFilter,
  mergedPullRequestsFilter,
  typeFilter,
  weekFilter,
} from '@/lib/insights-pull-requests';

describe('the filters behind each pull request number', () => {
  it('narrows to what merged, in a week and a repository', () => {
    expect(mergedPullRequestsFilter()).toEqual({ state: 'merged' });
    expect(weekFilter('2026-09-28', 'acme/api', 'spotlight')).toEqual({
      state: 'merged',
      week: '2026-09-28',
      repository: 'acme/api',
      author: 'spotlight',
    });
    expect(weekFilter('2026-09-28', null)).toEqual({
      state: 'merged',
      week: '2026-09-28',
    });
  });

  it('counts people’s pull requests only in the repositories Spotlight merged into', () => {
    expect(groupFilter('people', ['acme/api', 'acme/web'])).toEqual({
      state: 'merged',
      author: 'people',
      repository: 'acme/api,acme/web',
    });
    expect(
      groupFilter('spotlight', ['acme/api'], { reverted: 'true' }),
    ).toEqual({ state: 'merged', author: 'spotlight', reverted: 'true' });
  });

  it('asks for the compared repositories by name where there are too many to list', () => {
    expect(
      groupFilter(
        'people',
        Array.from({ length: 51 }, (_, at) => `acme/r${at}`),
      ),
    ).toEqual({ state: 'merged', author: 'people', compared: 'true' });
  });

  it('narrows to a type someone shipped', () => {
    expect(typeFilter('fix', 'spotlight')).toEqual({
      state: 'merged',
      type: 'fix',
      author: 'spotlight',
    });
  });
});

describe('formatPullRequestFilterValue', () => {
  it('names what a filter narrows by in words', () => {
    expect(formatPullRequestFilterValue('author', 'touched')).toBe(
      'Others, with a Spotlight review task',
    );
    expect(formatPullRequestFilterValue('author', 'bots')).toBe('Bots alone');
    expect(formatPullRequestFilterValue('compared', 'true')).toBe(
      'Where Spotlight merged',
    );
    expect(formatPullRequestFilterValue('rounds', '3+')).toBe(
      '3 or more rounds',
    );
    expect(
      formatPullRequestFilterValue('repository', 'acme/api,acme/web'),
    ).toBe('2 repositories');
  });
});
