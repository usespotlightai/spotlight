import {
  day,
  historyOf,
  humanActionsOf,
} from '@insights/domain/insights.fake-spec';
import { teamPullRequestOf } from '@insights/domain/pull-requests.fake-spec';
import { endedRecord } from '@insights/domain/runs.fake-spec';
import {
  type FlowStageKind,
  pipelineCountsOf,
  type Shipping,
  shippedTaskIdsOf,
  shippingCountsOf,
  shippingFrom,
} from '@insights/domain/services/shipping';
import type { TeamHistory } from '@insights/domain/services/team-history';
import type { TeamPullRequest } from '@insights/domain/services/team-pull-requests';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
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

const shippedOf = (
  pullRequests: readonly TeamPullRequest[],
  history: TeamHistory,
  period: InsightsPeriod,
) =>
  shippingFrom(
    shippingCountsOf(
      pullRequests,
      pipelineCountsOf(history, shippedTaskIdsOf(pullRequests, period), period),
      period,
    ),
  );

const timesAt = (pipeline: Shipping['pipeline'], kind: FlowStageKind) =>
  pipeline.layouts.stages.find((each) => each.kind === kind)?.times;

describe('the Shipping tab', () => {
  it('times opened to merged for Spotlight and for people in the repositories Spotlight merged into', () => {
    const shipping = shippedOf(
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
    expect(shipping.toMergeChanges.spotlight.p50).toEqual({
      unit: 'percent',
      by: 1,
      fromZero: false,
      direction: 'up',
      tone: 'bad',
    });
    expect(shipping.toMergeChanges.people.p50).toBeNull();
  });

  it('goes day by day, each day on its own and over the 7 days ending it', () => {
    const shipping = shippedOf(
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

  it('times each type, slowest first at each percentile, and buckets review rounds week by week and over the period', () => {
    const shipping = shippedOf(
      [
        merged(1, '2026-09-29', 9, {
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
    expect(shipping.slowestFirst).toEqual({
      p50: ['fix', 'feature'],
      p75: ['fix', 'feature'],
      p90: ['fix', 'feature'],
      p95: ['fix', 'feature'],
    });
    const counted = [
      { rounds: '0', merged: 0, rate: 0 },
      { rounds: '1', merged: 1, rate: 0.5 },
      { rounds: '2', merged: 0, rate: 0 },
      { rounds: '3+', merged: 1, rate: 0.5 },
    ];
    expect(shipping.depth[shipping.depth.length - 1]).toEqual({
      week: '2026-09-28',
      merged: 2,
      rounds: counted,
    });
    expect(shipping.depth[0]?.rounds.map((each) => each.rate)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(shipping.depthTotals).toEqual(counted);
  });

  it('times ready for review to the first review, counts who still waits and human reviews, leaving drafts and bots’ pull requests out', () => {
    const shipping = shippedOf(
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
    const shipping = shippedOf(
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
      { login: 'coderabbit', comments: 5, reviews: 2, resolvedRate: 0.75 },
      { login: 'linter', comments: 1, reviews: 0, resolvedRate: null },
    ]);
  });

  it('puts a type only people merged after the types Spotlight merged', () => {
    const shipping = shippedOf(
      [
        merged(1, '2026-09-29', 2, { type: 'chore' }),
        merged(2, '2026-09-29', 4, { by: 'spotlight', type: 'feature' }),
        merged(3, '2026-09-30', 9, { by: 'spotlight', type: 'fix' }),
      ],
      NOTHING,
      PERIOD,
    );

    expect(shipping.slowestFirst.p50).toEqual(['fix', 'feature', 'chore']);
  });

  it('names no longest part at a station where no part took any time', () => {
    const history = historyOf({
      records: [
        endedRecord('run_1', {
          taskId: 'task_1',
          queuedAt: day('2026-09-28', 9),
          startedAt: day('2026-09-28', 9),
          endedAt: day('2026-09-28', 9),
        }),
      ],
      taskHumanActions: [
        humanActionsOf('task_1', { openedAt: day('2026-09-28', 8) }),
      ],
    });

    const { pipeline } = shippedOf(
      [merged(1, '2026-09-29', 4, { by: 'spotlight', taskId: 'task_1' })],
      history,
      PERIOD,
    );

    expect(pipeline.layouts.stations[0]?.times.all.longestPart).toEqual({
      p50: null,
      p75: null,
      p90: null,
      p95: null,
    });
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
      taskHumanActions: [
        humanActionsOf('task_1', { openedAt: day('2026-09-28', 8) }),
      ],
    });

    const { pipeline } = shippedOf(
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
    expect(timesAt(pipeline, 'coding')?.all.total.p50).toBe(2 * HOUR);
    expect(pipeline.layouts.stations.map((each) => each.kind)).toEqual([
      'station',
      'awaitingReview',
      'inReview',
      'awaitingMerge',
    ]);
    expect(pipeline.layouts.stations[0]).toMatchObject({
      location: { stationId: 'station_1' },
      times: {
        all: {
          total: { p50: 35 * MINUTE },
          parts: {
            queued: { p50: 5 * MINUTE },
            running: { p50: 30 * MINUTE },
            inbox: { p50: 0 },
          },
          longestPart: { p50: 'running', p95: 'running' },
        },
      },
    });
    expect(timesAt(pipeline, 'inReview')?.all.longestPart).toBeNull();
    expect(timesAt(pipeline, 'awaitingReview')?.all.total.p50).toBe(3 * HOUR);
    expect(timesAt(pipeline, 'inReview')?.all.total.p50).toBe(19 * HOUR);
    expect(timesAt(pipeline, 'awaitingMerge')?.all.total.p50).toBe(3 * HOUR);
    expect(timesAt(pipeline, 'awaitingMerge')?.types).toEqual([
      { type: 'feature', times: expect.objectContaining({ parts: null }) },
    ]);
  });

  it('weighs each stage against the longest in its layout, for all pull requests and for each type, and marks the longest', () => {
    const shipped = (
      number: number,
      type: 'feature' | 'fix',
      on: string,
      hours: {
        opened: number;
        reviewed: number;
        approved: number;
        closed: number;
      },
    ) =>
      teamPullRequestOf(number, {
        by: 'spotlight',
        taskId: `task_${number}`,
        type,
        seen: {
          state: 'merged',
          openedAt: day(on, hours.opened),
          readyForReviewAt: day(on, hours.opened),
          firstUnblockingReviewAt: day(on, hours.reviewed),
          firstApprovedAt: day(on, hours.approved),
          closedAt: day(on, hours.closed),
        },
      });
    const { pipeline } = shippedOf(
      [
        shipped(1, 'feature', '2026-09-28', {
          opened: 10,
          reviewed: 14,
          approved: 15,
          closed: 16,
        }),
        shipped(2, 'fix', '2026-09-29', {
          opened: 9,
          reviewed: 10,
          approved: 16,
          closed: 17,
        }),
      ],
      historyOf({
        taskHumanActions: [
          humanActionsOf('task_1', { openedAt: day('2026-09-28', 8) }),
          humanActionsOf('task_2', { openedAt: day('2026-09-29', 8) }),
        ],
      }),
      PERIOD,
    );
    const bottleneckRatios = (
      layout: 'stations' | 'stages',
      type: 'feature' | 'fix' | null,
    ) =>
      pipeline.layouts[layout].map((stage) => {
        const times = type
          ? stage.times.types.find((each) => each.type === type)?.times
          : stage.times.all;

        return [stage.kind, times?.bottleneckRatio.p50, times?.worst.p50];
      });

    expect(bottleneckRatios('stages', null)).toEqual([
      ['coding', 1.5 / 3.5, false],
      ['awaitingReview', 2.5 / 3.5, false],
      ['inReview', 1, true],
      ['awaitingMerge', 1 / 3.5, false],
    ]);
    expect(bottleneckRatios('stations', null)).toEqual([
      ['awaitingReview', 2.5 / 3.5, false],
      ['inReview', 1, true],
      ['awaitingMerge', 1 / 3.5, false],
    ]);
    expect(bottleneckRatios('stages', 'feature')).toEqual([
      ['coding', 0.5, false],
      ['awaitingReview', 1, true],
      ['inReview', 0.25, false],
      ['awaitingMerge', 0.25, false],
    ]);
    expect(bottleneckRatios('stages', 'fix')).toEqual([
      ['coding', 1 / 6, false],
      ['awaitingReview', 1 / 6, false],
      ['inReview', 1, true],
      ['awaitingMerge', 1 / 6, false],
    ]);
  });

  it('marks the first of equally long stages as the longest, and none where nothing was measured', () => {
    const { pipeline } = shippedOf(
      [
        teamPullRequestOf(1, {
          by: 'spotlight',
          taskId: 'task_1',
          seen: {
            state: 'merged',
            openedAt: day('2026-09-29', 9),
            readyForReviewAt: day('2026-09-29', 9),
            firstUnblockingReviewAt: day('2026-09-29', 11),
            firstApprovedAt: day('2026-09-29', 13),
            closedAt: day('2026-09-29', 13),
          },
        }),
      ],
      historyOf({
        taskHumanActions: [
          humanActionsOf('task_1', { openedAt: day('2026-09-29', 7) }),
        ],
      }),
      PERIOD,
    );
    const worst = (stages: typeof pipeline.layouts.stages) =>
      stages.map((stage) => stage.times.all.worst.p50);

    expect(worst(pipeline.layouts.stages)).toEqual([true, false, false, false]);
    expect(
      worst(shippedOf([], NOTHING, PERIOD).pipeline.layouts.stages),
    ).toEqual([false, false, false, false]);
  });

  it('counts a review before the pull request was ready, or an approval after the merge, as no wait', () => {
    const { pipeline, reviewDays } = shippedOf(
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
        taskHumanActions: [
          humanActionsOf('task_1', { openedAt: day('2026-09-29', 6) }),
        ],
      }),
      PERIOD,
    );

    expect(
      reviewDays.find((each) => each.day === '2026-09-29')?.toFirstReview.daily,
    ).toMatchObject({ p50: 0, count: 1 });
    expect(timesAt(pipeline, 'awaitingReview')?.all.total.p50).toBe(0);
    expect(timesAt(pipeline, 'inReview')?.all.total.p50).toBe(6 * HOUR);
    expect(timesAt(pipeline, 'awaitingMerge')?.all.total.p50).toBe(0);
  });

  it('tells a period with nothing merged, waiting or reviewed apart', () => {
    expect(shippedOf([], NOTHING, PERIOD).shippedAny).toBe(false);
    expect(
      shippedOf(
        [merged(1, '2026-09-30', 2, { by: 'spotlight' })],
        NOTHING,
        PERIOD,
      ).shippedAny,
    ).toBe(true);
    expect(
      shippedOf(
        [merged(1, '2026-08-01', 2, { by: 'spotlight' })],
        NOTHING,
        PERIOD,
      ).shippedAny,
    ).toBe(false);
  });

  it('counts only the period’s merges in the week it starts in', () => {
    const shipping = shippedOf(
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

  it('follows only the tasks opened within the history it has', () => {
    const { pipeline } = shippedOf(
      [
        merged(1, '2026-09-29', 4, { by: 'spotlight', taskId: 'task_1' }),
        merged(2, '2026-09-30', 4, { by: 'spotlight', taskId: 'task_2' }),
        merged(3, '2026-09-30', 4, { by: 'spotlight', taskId: 'task_3' }),
      ],
      historyOf({
        taskHumanActions: [
          humanActionsOf('task_1', { openedAt: day('2026-09-28', 8) }),
          humanActionsOf('task_2', { openedAt: day('2026-07-01', 8) }),
        ],
      }),
      PERIOD,
    );

    expect(pipeline.merged).toBe(1);
    expect(timesAt(pipeline, 'coding')?.all.total.count).toBe(1);
  });

  it('leaves a pull request out of who waits while it is back as a draft, and takes that time off its wait', () => {
    const { reviewDays, pipeline } = shippedOf(
      [
        teamPullRequestOf(1, {
          by: 'spotlight',
          taskId: 'task_1',
          seen: {
            state: 'merged',
            openedAt: day('2026-09-28', 8),
            readyForReviewAt: day('2026-09-28', 9),
            draftPeriods: [
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
            draftPeriods: [{ from: day('2026-09-29', 10), to: null }],
          },
        }),
      ],
      historyOf({
        taskHumanActions: [
          humanActionsOf('task_1', { openedAt: day('2026-09-28', 6) }),
        ],
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
    expect(timesAt(pipeline, 'awaitingReview')?.all.total.p50).toBe(3 * HOUR);
  });

  it('takes every draft period off the wait, only where it fell between ready and the first review', () => {
    const waited = (
      periods: { from: Date; to: Date | null }[],
      reviewedAt = day('2026-09-29', 21),
    ) =>
      shippedOf(
        [
          teamPullRequestOf(1, {
            seen: {
              openedAt: day('2026-09-29', 6),
              readyForReviewAt: day('2026-09-29', 9),
              draftPeriods: periods,
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
    const { reviewDays } = shippedOf(
      [
        teamPullRequestOf(1, {
          seen: {
            state: 'closed',
            openedAt: day('2026-09-28', 8),
            readyForReviewAt: day('2026-09-28', 9),
            draftPeriods: [{ from: day('2026-09-29', 10), to: null }],
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
