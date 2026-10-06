import { day, historyOf, touchesOf } from '@outcomes/domain/insights.fake-spec';
import { endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import { teamPullRequestOf } from '@outcomes/domain/pull-requests.fake-spec';
import { shippingOf } from '@outcomes/domain/services/shipping';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

const merged = (
  number: number,
  on: string,
  hours: number,
  over: Parameters<typeof teamPullRequestOf>[1] = {},
) =>
  teamPullRequestOf(number, {
    ...over,
    seen: {
      state: 'merged',
      openedAt: new Date(day(on).getTime() - hours * HOUR),
      readyForReviewAt: new Date(day(on).getTime() - hours * HOUR),
      closedAt: day(on),
      ...over.seen,
    },
  });

const NOTHING = historyOf({});

describe('shippingOf', () => {
  it('times opened to merged for Spotlight and for people in the repositories Spotlight merged into', () => {
    const shipping = shippingOf(
      [
        merged(1, '2026-09-29', 4, { by: 'spotlight', taskId: 'task_1' }),
        merged(2, '2026-09-30', 10),
        merged(3, '2026-09-30', 50, { seen: { repository: 'acme/other' } }),
        merged(4, '2026-09-20', 2, { by: 'spotlight', taskId: 'task_4' }),
      ],
      NOTHING,
      PERIOD,
    );

    expect(shipping.toMerge.spotlight).toMatchObject({
      p50: 4 * HOUR,
      count: 1,
    });
    expect(shipping.toMerge.people).toMatchObject({ p50: 10 * HOUR, count: 1 });
    expect(shipping.toMergeBefore.spotlight).toMatchObject({
      p50: 2 * HOUR,
      count: 1,
    });
  });

  it('goes day by day, each day on its own and over the 7 days ending it', () => {
    const shipping = shippingOf(
      [
        merged(1, '2026-09-28', 2, { by: 'spotlight' }),
        merged(2, '2026-09-30', 6, { by: 'spotlight' }),
      ],
      NOTHING,
      PERIOD,
    );
    const on = (date: string) =>
      shipping.mergeDays.find((each) => each.day === date);

    expect(shipping.mergeDays.map((each) => each.day)).toEqual(PERIOD.days);
    expect(on('2026-09-29')?.daily.spotlight.count).toBe(0);
    expect(on('2026-09-30')?.daily.spotlight).toMatchObject({
      p50: 6 * HOUR,
      count: 1,
    });
    expect(on('2026-09-30')?.rolling.spotlight.count).toBe(2);
  });

  it('times each type and buckets review rounds week by week', () => {
    const shipping = shippingOf(
      [
        merged(1, '2026-09-29', 4, {
          by: 'spotlight',
          type: 'fix',
          seen: { reviewRounds: 1 },
        }),
        merged(2, '2026-09-30', 8, {
          by: 'spotlight',
          seen: { reviewRounds: 4 },
        }),
      ],
      NOTHING,
      PERIOD,
    );

    expect(shipping.types.map((each) => [each.type, each.merged])).toEqual([
      ['feature', 1],
      ['fix', 1],
    ]);
    expect(shipping.depth[shipping.depth.length - 1]).toMatchObject({
      week: '2026-09-28',
      merged: 2,
      rounds: { '0': 0, '1': 1, '2': 0, '3+': 1 },
    });
  });

  it('times ready for review to the first review, counts who still waits and human reviews, leaving drafts and bots’ pull requests out', () => {
    const shipping = shippingOf(
      [
        teamPullRequestOf(1, {
          seen: {
            openedAt: day('2026-09-29', 8),
            readyForReviewAt: day('2026-09-29', 10),
            firstUnblockingReviewAt: day('2026-09-29', 13),
            humanReviewedAt: [day('2026-09-29', 13), day('2026-09-30', 9)],
          },
        }),
        teamPullRequestOf(2, {
          seen: {
            openedAt: day('2026-09-29', 9),
            readyForReviewAt: day('2026-09-29', 9),
          },
        }),
        teamPullRequestOf(4, {
          seen: { openedAt: day('2026-09-29', 9), readyForReviewAt: null },
        }),
        teamPullRequestOf(5, {
          seen: {
            openedAt: day('2026-09-29', 8),
            readyForReviewAt: null,
            firstUnblockingReviewAt: day('2026-09-29', 11),
          },
        }),
        teamPullRequestOf(3, {
          by: 'bots',
          seen: { openedAt: day('2026-09-29', 9), authorIsBot: true },
        }),
      ],
      NOTHING,
      PERIOD,
    );
    const on = (date: string) =>
      shipping.reviewDays.find((each) => each.day === date);

    expect(on('2026-09-29')?.toFirstReview.daily).toMatchObject({
      p50: 3 * HOUR,
      count: 1,
    });
    expect(on('2026-09-28')?.awaiting).toBe(0);
    expect(on('2026-09-29')?.awaiting).toBe(1);
    expect(on('2026-09-29')?.humanReviews).toBe(1);
    expect(on('2026-09-30')?.humanReviews).toBe(1);
  });

  it('sums each bot’s activity over the pull requests active in the period, busiest first', () => {
    const shipping = shippingOf(
      [
        teamPullRequestOf(1, {
          seen: {
            openedAt: day('2026-09-29', 8),
            botActivity: [
              {
                login: 'coderabbit',
                reviews: 1,
                comments: 3,
                threads: 2,
                resolvedThreads: 1,
              },
              {
                login: 'linter',
                reviews: 0,
                comments: 1,
                threads: 0,
                resolvedThreads: 0,
              },
            ],
          },
        }),
        teamPullRequestOf(2, {
          seen: {
            openedAt: day('2026-09-30', 8),
            botActivity: [
              {
                login: 'coderabbit',
                reviews: 1,
                comments: 2,
                threads: 2,
                resolvedThreads: 2,
              },
            ],
          },
        }),
        merged(3, '2026-09-10', 2, {
          seen: {
            botActivity: [
              {
                login: 'stale',
                reviews: 9,
                comments: 9,
                threads: 0,
                resolvedThreads: 0,
              },
            ],
          },
        }),
      ],
      NOTHING,
      PERIOD,
    );

    expect(shipping.bots).toEqual([
      { login: 'coderabbit', comments: 5, reviews: 2, resolvedShare: 0.75 },
      { login: 'linter', comments: 1, reviews: 0, resolvedShare: null },
    ]);
  });

  it('follows Spotlight’s merged pull requests from the task opening through stations and review', () => {
    const history = historyOf({
      records: [
        endedRecord('run_1', {
          taskId: 'task_1',
          queuedAt: day('2026-09-28', 9),
          startedAt: new Date(day('2026-09-28', 9).getTime() + 5 * MINUTE),
          endedAt: new Date(day('2026-09-28', 9).getTime() + 35 * MINUTE),
        }),
      ],
      touches: [touchesOf('task_1', { openedAt: day('2026-09-28', 8) })],
    });

    const { pipeline } = shippingOf(
      [
        teamPullRequestOf(1, {
          by: 'spotlight',
          taskId: 'task_1',
          seen: {
            state: 'merged',
            openedAt: day('2026-09-28', 10),
            readyForReviewAt: day('2026-09-28', 11),
            firstUnblockingReviewAt: day('2026-09-28', 14),
            firstApprovedAt: day('2026-09-29', 9),
            closedAt: day('2026-09-29', 12),
          },
        }),
        merged(2, '2026-09-29', 4),
      ],
      history,
      PERIOD,
    );

    expect(pipeline.merged).toBe(1);
    expect(pipeline.types).toEqual([{ type: 'feature', merged: 1 }]);
    expect(pipeline.coding.all.total.p50).toBe(2 * HOUR);
    expect(pipeline.stations).toHaveLength(1);
    expect(pipeline.stations[0]).toMatchObject({
      stationId: 'station_1',
      times: {
        all: {
          total: { p50: 35 * MINUTE },
          parts: {
            queued: { p50: 5 * MINUTE },
            running: { p50: 30 * MINUTE },
            inbox: { p50: 0 },
          },
        },
      },
    });
    expect(pipeline.review.awaitingReview.all.total.p50).toBe(3 * HOUR);
    expect(pipeline.review.inReview.all.total.p50).toBe(19 * HOUR);
    expect(pipeline.review.awaitingMerge.all.total.p50).toBe(3 * HOUR);
    expect(pipeline.review.awaitingMerge.types).toEqual([
      { type: 'feature', times: expect.objectContaining({ parts: null }) },
    ]);
  });

  it('counts a review before the pull request was ready, or an approval after the merge, as no wait', () => {
    const { pipeline, reviewDays } = shippingOf(
      [
        teamPullRequestOf(1, {
          by: 'spotlight',
          taskId: 'task_1',
          seen: {
            state: 'merged',
            openedAt: day('2026-09-29', 8),
            readyForReviewAt: day('2026-09-29', 12),
            firstUnblockingReviewAt: day('2026-09-29', 10),
            firstApprovedAt: day('2026-09-29', 18),
            closedAt: day('2026-09-29', 16),
          },
        }),
      ],
      historyOf({
        touches: [touchesOf('task_1', { openedAt: day('2026-09-29', 6) })],
      }),
      PERIOD,
    );

    expect(
      reviewDays.find((each) => each.day === '2026-09-29')?.toFirstReview.daily,
    ).toMatchObject({ p50: 0, count: 1 });
    expect(pipeline.review.awaitingReview.all.total.p50).toBe(0);
    expect(pipeline.review.inReview.all.total.p50).toBe(6 * HOUR);
    expect(pipeline.review.awaitingMerge.all.total.p50).toBe(0);
  });

  it('counts only the period’s merges in the week it starts in', () => {
    const shipping = shippingOf(
      [
        merged(1, '2026-09-23', 2, { by: 'spotlight' }),
        merged(2, '2026-09-25', 2, { by: 'spotlight' }),
      ],
      NOTHING,
      PERIOD,
    );

    expect(shipping.depth[0]).toMatchObject({
      week: '2026-09-21',
      merged: 1,
    });
  });

  it('follows only the tasks opened within the history it holds', () => {
    const { pipeline } = shippingOf(
      [
        merged(1, '2026-09-29', 4, { by: 'spotlight', taskId: 'task_1' }),
        merged(2, '2026-09-30', 4, { by: 'spotlight', taskId: 'task_2' }),
        merged(3, '2026-09-30', 4, { by: 'spotlight', taskId: 'task_3' }),
      ],
      historyOf({
        touches: [
          touchesOf('task_1', { openedAt: day('2026-09-28', 8) }),
          touchesOf('task_2', { openedAt: day('2026-07-01', 8) }),
        ],
      }),
      PERIOD,
    );

    expect(pipeline.merged).toBe(1);
    expect(pipeline.coding.all.total.count).toBe(1);
  });

  it('leaves a pull request out of who waits while it is back as a draft, and takes that time off its wait', () => {
    const { reviewDays, pipeline } = shippingOf(
      [
        teamPullRequestOf(1, {
          by: 'spotlight',
          taskId: 'task_1',
          seen: {
            state: 'merged',
            openedAt: day('2026-09-28', 8),
            readyForReviewAt: day('2026-09-28', 9),
            draftSpells: [
              { from: day('2026-09-28', 10), to: day('2026-09-29', 10) },
            ],
            firstUnblockingReviewAt: day('2026-09-29', 12),
            closedAt: day('2026-09-29', 14),
          },
        }),
        teamPullRequestOf(2, {
          seen: {
            openedAt: day('2026-09-28', 8),
            readyForReviewAt: day('2026-09-28', 9),
            draftSpells: [{ from: day('2026-09-29', 10), to: null }],
          },
        }),
      ],
      historyOf({
        touches: [touchesOf('task_1', { openedAt: day('2026-09-28', 6) })],
      }),
      PERIOD,
    );
    const on = (date: string) => reviewDays.find((each) => each.day === date);

    expect(on('2026-09-27')?.awaiting).toBe(0);
    expect(on('2026-09-28')?.awaiting).toBe(1);
    expect(on('2026-09-29')?.awaiting).toBe(0);
    expect(on('2026-09-29')?.toFirstReview.daily).toMatchObject({
      p50: 3 * HOUR,
      count: 1,
    });
    expect(pipeline.review.awaitingReview.all.total.p50).toBe(3 * HOUR);
  });

  it('takes every spell back as a draft off the wait, only where it fell between ready and the first review', () => {
    const waited = (
      spells: { from: Date; to: Date | null }[],
      reviewedAt = day('2026-09-29', 21),
    ) =>
      shippingOf(
        [
          teamPullRequestOf(1, {
            seen: {
              openedAt: day('2026-09-29', 6),
              readyForReviewAt: day('2026-09-29', 9),
              draftSpells: spells,
              firstUnblockingReviewAt: reviewedAt,
            },
          }),
        ],
        NOTHING,
        PERIOD,
      ).reviewDays.find((each) => each.day === '2026-09-29')?.toFirstReview
        .daily.p50;

    expect(
      waited([
        { from: day('2026-09-29', 10), to: day('2026-09-29', 12) },
        { from: day('2026-09-29', 14), to: day('2026-09-29', 17) },
      ]),
    ).toBe(7 * HOUR);
    expect(
      waited([{ from: day('2026-09-29', 7), to: day('2026-09-29', 10) }]),
    ).toBe(11 * HOUR);
    expect(waited([{ from: day('2026-09-29', 18), to: null }])).toBe(9 * HOUR);
  });

  it('stops counting a closed pull request as waiting, even while back as a draft', () => {
    const { reviewDays } = shippingOf(
      [
        teamPullRequestOf(1, {
          seen: {
            state: 'closed',
            openedAt: day('2026-09-28', 8),
            readyForReviewAt: day('2026-09-28', 9),
            draftSpells: [{ from: day('2026-09-29', 10), to: null }],
            closedAt: day('2026-09-29', 11),
          },
        }),
      ],
      NOTHING,
      PERIOD,
    );

    expect(
      reviewDays
        .map((each) => [each.day, each.awaiting])
        .filter(([, awaiting]) => awaiting !== 0),
    ).toEqual([['2026-09-28', 1]]);
  });
});
