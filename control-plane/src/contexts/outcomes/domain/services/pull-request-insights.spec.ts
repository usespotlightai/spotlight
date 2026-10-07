import { teamPullRequestOf } from '@outcomes/domain/pull-requests.fake-spec';
import {
  comparisonOf,
  depthOf,
  penetrationOf,
  typesOf,
  weekOf,
  weeksOf,
} from '@outcomes/domain/services/pull-request-insights';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const HOUR = 60 * 60 * 1000;

const WINDOW: Window = {
  from: new Date('2026-09-17T00:00:00.000Z'),
  to: new Date('2026-10-02T00:00:00.000Z'),
};

const day = (date: string, hour = 12) =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);

const merged = (
  number: number,
  on: string,
  over: Parameters<typeof teamPullRequestOf>[1] = {},
) =>
  teamPullRequestOf(number, {
    ...over,
    seen: {
      state: 'merged',
      openedAt: new Date(day(on).getTime() - 10 * HOUR),
      closedAt: day(on),
      ...over.seen,
    },
  });

describe('weeks', () => {
  it('starts each week on its Monday, UTC', () => {
    expect(weekOf(day('2026-09-30'))).toBe('2026-09-28');
    expect(weekOf(day('2026-09-28', 0))).toBe('2026-09-28');
    expect(weekOf(day('2026-09-27', 23))).toBe('2026-09-21');
  });

  it('lists every week the period touches, oldest first', () => {
    expect(weeksOf(WINDOW)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28']);
  });
});

describe('penetrationOf', () => {
  const pullRequests = [
    merged(1, '2026-09-22', { by: 'spotlight', taskId: 'task_1' }),
    merged(2, '2026-09-23', { by: 'touched', reviewTaskIds: ['task_9'] }),
    merged(3, '2026-09-29'),
    merged(4, '2026-09-30', {
      by: 'spotlight',
      seen: { repository: 'acme/web' },
    }),
    teamPullRequestOf(5, { by: 'spotlight' }),
    merged(6, '2026-08-01', { by: 'spotlight' }),
  ];

  it('shares merged pull requests out between what Spotlight made, touched and left to people', () => {
    expect(penetrationOf(pullRequests, ['acme/api'], WINDOW)).toMatchObject({
      merged: 4,
      made: 2,
      touched: 1,
      bots: 0,
      share: 0.75,
    });
  });

  it('counts bots’ pull requests in the whole, apart from people’s', () => {
    expect(
      penetrationOf(
        [
          ...pullRequests,
          merged(7, '2026-09-29', {
            by: 'bots',
            seen: { authorIsBot: true },
          }),
        ],
        ['acme/api'],
        WINDOW,
      ),
    ).toMatchObject({
      merged: 5,
      made: 2,
      touched: 1,
      spotlight: 3,
      people: 1,
      bots: 1,
      share: 0.6,
    });
  });

  it('goes week by week, for the team and for each repository', () => {
    const penetration = penetrationOf(pullRequests, ['acme/api'], WINDOW);

    expect(penetration.weeks).toEqual([
      {
        week: '2026-09-14',
        merged: 0,
        made: 0,
        touched: 0,
        spotlight: 0,
        people: 0,
        bots: 0,
        share: null,
      },
      {
        week: '2026-09-21',
        merged: 2,
        made: 1,
        touched: 1,
        spotlight: 2,
        people: 0,
        bots: 0,
        share: 1,
      },
      {
        week: '2026-09-28',
        merged: 2,
        made: 1,
        touched: 0,
        spotlight: 1,
        people: 1,
        bots: 0,
        share: 0.5,
      },
    ]);
    expect(
      penetration.repositories.map((each) => [
        each.repository,
        each.merged,
        each.share,
      ]),
    ).toEqual([
      ['acme/api', 3, 2 / 3],
      ['acme/web', 1, 1],
    ]);
  });

  it('lists the team’s repositories even where nothing merged, and names each once whatever its case', () => {
    expect(
      penetrationOf(
        [merged(1, '2026-09-22', { seen: { repository: 'Acme/API' } })],
        ['acme/api', 'acme/docs'],
        WINDOW,
      ).repositories.map((each) => [each.repository, each.merged]),
    ).toEqual([
      ['acme/api', 1],
      ['acme/docs', 0],
    ]);
  });
});

describe('comparisonOf', () => {
  it('sets Spotlight’s merged pull requests against people’s alone, in the repositories Spotlight merged into', () => {
    const comparison = comparisonOf(
      [
        merged(1, '2026-09-22', {
          by: 'spotlight',
          seen: {
            openedAt: day('2026-09-22', 2),
            closedAt: day('2026-09-22', 4),
            firstReviewAt: day('2026-09-22', 3),
            reviewRounds: 1,
            reviewComments: 2,
          },
        }),
        merged(2, '2026-09-23', {
          by: 'spotlight',
          seen: {
            openedAt: day('2026-09-23', 2),
            closedAt: day('2026-09-23', 6),
            reviewRounds: 3,
            reviewComments: 0,
            revertedBy: 'https://github.com/acme/api/pull/9',
          },
        }),
        merged(3, '2026-09-24', {
          seen: {
            openedAt: day('2026-09-24', 0),
            closedAt: day('2026-09-24', 8),
            reviewRounds: 2,
            reviewComments: 4,
          },
        }),
        merged(4, '2026-09-24', { seen: { repository: 'acme/web' } }),
        merged(5, '2026-09-24', { by: 'touched' }),
        merged(6, '2026-09-24', {
          by: 'bots',
          seen: { authorIsBot: true, reviewRounds: 0 },
        }),
      ],
      WINDOW,
    );

    expect(comparison.repositories).toEqual(['acme/api']);
    expect(comparison.spotlight).toEqual({
      merged: 2,
      toMerge: { p50: 3 * HOUR, p90: 4 * HOUR, count: 2 },
      inReview: { p50: HOUR, p90: HOUR, count: 1 },
      meanRounds: 2,
      meanComments: 1,
      reverted: 1,
      revertRate: 0.5,
    });
    expect(comparison.people).toMatchObject({
      merged: 1,
      toMerge: { p50: 8 * HOUR, p90: 8 * HOUR, count: 1 },
      meanRounds: 2,
      meanComments: 4,
      reverted: 0,
      revertRate: 0,
    });
  });

  it('measures nothing where nothing merged', () => {
    expect(comparisonOf([], WINDOW).spotlight).toEqual({
      merged: 0,
      toMerge: { p50: null, p90: null, count: 0 },
      inReview: { p50: null, p90: null, count: 0 },
      meanRounds: null,
      meanComments: null,
      reverted: 0,
      revertRate: null,
    });
  });
});

describe('typesOf', () => {
  it('counts what merged by type, with what Spotlight’s cost', () => {
    const types = typesOf(
      [
        merged(1, '2026-09-22', {
          by: 'spotlight',
          type: 'fix',
          spends: [
            { amount: 1.5, currency: 'USD' },
            { amount: 0.5, currency: 'USD' },
          ],
        }),
        merged(2, '2026-09-22', {
          by: 'spotlight',
          type: 'fix',
          spends: [{ amount: 1, currency: 'USD' }, null],
        }),
        merged(3, '2026-09-22', { type: 'fix' }),
        merged(4, '2026-09-22', { by: 'touched', type: 'fix' }),
        merged(5, '2026-09-22', { by: 'spotlight', type: 'tests' }),
      ],
      WINDOW,
    );

    expect(types.map((each) => each.type)).toEqual([
      'feature',
      'fix',
      'refactor',
      'tests',
      'chore',
      'other',
    ]);
    expect(types[1]).toEqual({
      type: 'fix',
      spotlight: 2,
      people: 1,
      spend: { amount: 3, currency: 'USD' },
      unpriced: 1,
      mixedCurrencies: false,
    });
    expect(types[3]).toMatchObject({ spotlight: 1, spend: null, unpriced: 0 });
  });

  it('counts people’s pull requests only in the repositories Spotlight merged into', () => {
    const [feature] = typesOf(
      [
        merged(1, '2026-09-22', { by: 'spotlight' }),
        merged(2, '2026-09-22', {}),
        merged(3, '2026-09-22', { seen: { repository: 'acme/web' } }),
      ],
      WINDOW,
    );

    expect(feature).toMatchObject({ type: 'feature', spotlight: 1, people: 1 });
  });

  it('gives no spend where prices came in more than one currency', () => {
    expect(
      typesOf(
        [
          merged(1, '2026-09-22', {
            by: 'spotlight',
            spends: [{ amount: 1, currency: 'USD' }],
          }),
          merged(2, '2026-09-22', {
            by: 'spotlight',
            spends: [{ amount: 1, currency: 'EUR' }],
          }),
        ],
        WINDOW,
      )[0],
    ).toMatchObject({ spend: null, mixedCurrencies: true });
  });
});

describe('depthOf', () => {
  it('buckets merged pull requests by review rounds, Spotlight’s against people’s', () => {
    expect(
      depthOf(
        [
          merged(1, '2026-09-22', {
            by: 'spotlight',
            seen: { reviewRounds: 0 },
          }),
          merged(2, '2026-09-22', {
            by: 'spotlight',
            seen: { reviewRounds: 4 },
          }),
          merged(3, '2026-09-22', { seen: { reviewRounds: 1 } }),
          merged(4, '2026-09-22', {
            seen: { reviewRounds: 1, repository: 'acme/web' },
          }),
          merged(5, '2026-09-22', {
            by: 'bots',
            seen: { reviewRounds: 0, authorIsBot: true },
          }),
        ],
        WINDOW,
      ),
    ).toEqual([
      { rounds: '0', spotlight: 1, people: 0 },
      { rounds: '1', spotlight: 0, people: 1 },
      { rounds: '2', spotlight: 0, people: 0 },
      { rounds: '3+', spotlight: 1, people: 0 },
    ]);
  });
});
