import { dailyOutputFrom } from '@insights/domain/services/daily-output';
import { flowFrom } from '@insights/domain/services/flow';
import {
  type HeadlineCounts,
  headlineFrom,
} from '@insights/domain/services/headline';
import type { PullRequestDelivery } from '@insights/domain/services/pull-request-delivery';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-20T12:00:00.000Z');
const PERIOD = InsightsPeriod.of('7d', NOW);
const HOUR_MS = 60 * 60 * 1000;
const SPAN_HOURS = 24 * 21;

const COUNTS: HeadlineCounts = {
  runs: 0,
  tasks: 0,
  spend: null,
  unpriced: 0,
  mixedCurrencies: false,
  actions: 0,
  people: [],
};

const NO_WORK = { stations: [], inbox: [] };

const hoursAfterStart = (hours: number): Date =>
  new Date(PERIOD.previous.from.getTime() + hours * HOUR_MS);

const delivery = fc
  .record({
    task: fc.integer({ min: 1, max: 4 }),
    opened: fc.integer({ min: 0, max: SPAN_HOURS }),
    review: fc.option(fc.integer({ min: 0, max: 48 }), { nil: null }),
    close: fc.option(
      fc.record({
        after: fc.integer({ min: 1, max: 96 }),
        merged: fc.boolean(),
      }),
      { nil: null },
    ),
  })
  .map(({ task, opened, review, close }) => ({
    taskId: `task_${task}`,
    openedAt: hoursAfterStart(opened),
    firstReviewAt: review === null ? null : hoursAfterStart(opened + review),
    closedAt: close === null ? null : hoursAfterStart(opened + close.after),
    merged: close?.merged ?? false,
    taskOpenedAt: hoursAfterStart(Math.max(0, opened - 1)),
  }));

const deliveries = fc.array(delivery, { maxLength: 12 }).map((each) =>
  each.map((one, at): PullRequestDelivery => ({
    ...one,
    pullRequest: `https://github.com/acme/api/pull/${at + 1}`,
  })),
);

const mergedCounts = (all: readonly PullRequestDelivery[]) => {
  const headline = headlineFrom(COUNTS, all, PERIOD.current);
  const flow = flowFrom(
    { current: NO_WORK, previous: NO_WORK, deliveries: all },
    PERIOD,
  );
  const daily = dailyOutputFrom(new Map(), all, PERIOD, []);

  return {
    headline,
    overview: headline.mergedPullRequests,
    flow: flow.delivery.merged,
    perDay: daily.reduce((sum, day) => sum + day.merged, 0),
  };
};

describe('pull requests merged', () => {
  it('count each pull request on its own, the same on the headline, the daily output and the flow', () => {
    fc.assert(
      fc.property(deliveries, (all) => {
        const { headline, overview, flow, perDay } = mergedCounts(all);
        const closedInPeriod = all.filter(
          (each) =>
            each.closedAt !== null &&
            each.closedAt >= PERIOD.current.from &&
            each.closedAt < PERIOD.current.to,
        );

        expect(flow).toBe(overview);
        expect(perDay).toBe(overview);
        expect(overview).toBe(
          closedInPeriod.filter((each) => each.merged).length,
        );
        expect(overview + headline.closedPullRequests).toBe(
          closedInPeriod.length,
        );
      }),
    );
  });

  it('counts the merged pull request of a task whose other pull request closed unmerged', () => {
    const closedAt = new Date('2026-11-19T10:00:00.000Z');
    const pullRequestOf = (number: number, merged: boolean) => ({
      taskId: 'task_1',
      pullRequest: `https://github.com/acme/api/pull/${number}`,
      openedAt: new Date('2026-11-18T10:00:00.000Z'),
      firstReviewAt: null,
      closedAt,
      merged,
      taskOpenedAt: new Date('2026-11-18T09:00:00.000Z'),
    });

    const { headline, flow } = mergedCounts([
      pullRequestOf(1, true),
      pullRequestOf(2, false),
    ]);

    expect(headline).toMatchObject({
      mergedPullRequests: 1,
      closedPullRequests: 1,
      mergeRate: 0.5,
      mergedTaskIds: ['task_1'],
    });
    expect(flow).toBe(1);
  });
});
