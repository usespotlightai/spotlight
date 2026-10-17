import { InvalidPullRequestFilterError } from '@outcomes/domain/exceptions/invalid-pull-request-filter.error';
import { teamPullRequestOf } from '@outcomes/domain/pull-requests.fake-spec';
import {
  filteredPullRequests,
  type PullRequestFilterQuery,
  pullRequestFilterOf,
} from '@outcomes/domain/services/pull-request-filter';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const WINDOW: Window = {
  from: new Date('2026-09-17T00:00:00.000Z'),
  to: new Date('2026-10-02T00:00:00.000Z'),
};

const NOTHING: PullRequestFilterQuery = {
  repository: null,
  author: null,
  type: null,
  state: null,
  week: null,
  reverted: null,
  rounds: null,
  compared: null,
};

const PULL_REQUESTS = [
  teamPullRequestOf(1, {
    by: 'spotlight',
    type: 'fix',
    seen: {
      state: 'merged',
      openedAt: new Date('2026-09-21T08:00:00Z'),
      closedAt: new Date('2026-09-22T08:00:00Z'),
      reviewRounds: 1,
    },
  }),
  teamPullRequestOf(2, {
    seen: {
      repository: 'acme/web',
      state: 'merged',
      openedAt: new Date('2026-09-28T08:00:00Z'),
      closedAt: new Date('2026-09-29T08:00:00Z'),
      revertedBy: 'https://github.com/acme/web/pull/3',
      reviewRounds: 4,
    },
  }),
  teamPullRequestOf(3, {
    by: 'touched',
    seen: { state: 'open', openedAt: new Date('2026-08-01T08:00:00Z') },
  }),
  teamPullRequestOf(4, {
    seen: {
      state: 'closed',
      openedAt: new Date('2026-08-01T08:00:00Z'),
      closedAt: new Date('2026-08-02T08:00:00Z'),
    },
  }),
  teamPullRequestOf(5, {
    by: 'bots',
    seen: {
      repository: 'acme/web',
      authorIsBot: true,
      state: 'open',
      openedAt: new Date('2026-07-01T08:00:00Z'),
    },
  }),
];

const numbers = (query: Partial<PullRequestFilterQuery>) =>
  filteredPullRequests(
    PULL_REQUESTS,
    pullRequestFilterOf({ ...NOTHING, ...query }),
    WINDOW,
  ).map((each) => each.seen.number);

describe('the pull request list', () => {
  it('lists what was opened or closed in the period, or is still open, the latest first', () => {
    expect(numbers({})).toEqual([2, 1, 3, 5]);
  });

  it('narrows by repository, whatever its case, author, type and state', () => {
    expect(numbers({ repository: ['ACME/web'] })).toEqual([2, 5]);
    expect(numbers({ author: 'spotlight' })).toEqual([1]);
    expect(numbers({ author: 'touched' })).toEqual([3]);
    expect(numbers({ author: 'bots' })).toEqual([5]);
    expect(numbers({ type: 'fix' })).toEqual([1]);
    expect(numbers({ state: 'merged' })).toEqual([2, 1]);
    expect(numbers({ state: 'open' })).toEqual([3, 5]);
  });

  it('narrows to the repositories Spotlight merged into, however many', () => {
    expect(numbers({ compared: 'true' })).toEqual([1, 3]);
    expect(numbers({ compared: 'false' })).toEqual([2, 1, 3, 5]);
  });

  it('lists pull requests closed at the same time in the order of their code units', () => {
    const at = new Date('2026-09-22T08:00:00Z');
    const listed = filteredPullRequests(
      [
        teamPullRequestOf(6, {
          seen: { repository: 'acme/lone', state: 'merged', closedAt: at },
        }),
        teamPullRequestOf(4, {
          seen: { repository: 'Acme/maths', state: 'merged', closedAt: at },
        }),
      ],
      pullRequestFilterOf(NOTHING),
      WINDOW,
    );

    expect(listed.map((each) => each.pullRequest)).toEqual([
      'https://github.com/Acme/maths/pull/4',
      'https://github.com/acme/lone/pull/6',
    ]);
  });

  it('narrows to what closed in a week, what was reverted and how many rounds it needed', () => {
    expect(numbers({ week: '2026-09-21' })).toEqual([1]);
    expect(numbers({ reverted: 'true' })).toEqual([2]);
    expect(numbers({ rounds: '3+' })).toEqual([2]);
    expect(numbers({ rounds: '1' })).toEqual([1]);
  });

  it('rejects a filter it does not know', () => {
    expect(() => pullRequestFilterOf({ ...NOTHING, author: 'robots' })).toThrow(
      InvalidPullRequestFilterError,
    );
    expect(() => pullRequestFilterOf({ ...NOTHING, reverted: 'yes' })).toThrow(
      InvalidPullRequestFilterError,
    );
    expect(() => pullRequestFilterOf({ ...NOTHING, state: 'draft' })).toThrow(
      InvalidPullRequestFilterError,
    );
    expect(() => pullRequestFilterOf({ ...NOTHING, week: 'monday' })).toThrow(
      InvalidPullRequestFilterError,
    );
    expect(() =>
      pullRequestFilterOf({
        ...NOTHING,
        repository: Array.from({ length: 51 }, (_, at) => `acme/r${at}`),
      }),
    ).toThrow(InvalidPullRequestFilterError);
  });

  it('rejects more than one value for a filter that takes one', () => {
    for (const query of [
      { author: ['spotlight', 'people'] },
      { type: ['fix', 'chore'] },
      { state: ['open', 'merged'] },
      { week: ['2026-09-21', '2026-09-28'] },
      { reverted: ['true', 'true'] },
      { rounds: ['1', '2'] },
      { compared: ['true', 'false'] },
    ]) {
      expect(() => pullRequestFilterOf({ ...NOTHING, ...query })).toThrow(
        InvalidPullRequestFilterError,
      );
    }
  });
});
