import {
  chatOf,
  day,
  deliveredOf,
  historyOf,
  touchesOf,
} from '@outcomes/domain/insights.fake-spec';
import { costedRecord, endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import {
  type Headline,
  headlineChangesOf,
  headlineCountsOf,
  headlineFrom,
  resolvedDeliveriesOf,
} from '@outcomes/domain/services/headline';
import {
  openingsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import {
  InsightsPeriod,
  type Window,
} from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

const headlineOf = (history: TeamHistory, window: Window): Headline =>
  headlineFrom(
    headlineCountsOf(history, window),
    resolvedDeliveriesOf(history, openingsOf(history.touches)),
    window,
  );

describe('headlineOf', () => {
  it('adds up spend, merges and their rate for the period alone', () => {
    const history = historyOf({
      records: [
        costedRecord('run_1', {
          taskId: 'task_1',
          endedAt: day('2026-09-26'),
          amount: 1,
        }),
        costedRecord('run_2', {
          taskId: 'task_2',
          endedAt: day('2026-09-27'),
          amount: 2,
        }),
        costedRecord('run_3', {
          taskId: 'task_3',
          endedAt: day('2026-09-20'),
          amount: 50,
        }),
        endedRecord('run_4', {
          taskId: 'task_4',
          endedAt: day('2026-09-28'),
          ending: 'withdrawn',
        }),
      ],
      deliveries: [
        deliveredOf('task_1', {
          openedAt: day('2026-09-26', 13),
          closedAt: day('2026-09-27'),
        }),
        deliveredOf('task_2', {
          openedAt: day('2026-09-27', 13),
          closedAt: day('2026-09-29'),
          merged: false,
        }),
        deliveredOf('task_3', {
          openedAt: day('2026-09-20', 13),
          closedAt: day('2026-09-21'),
        }),
      ],
    });

    expect(headlineOf(history, PERIOD.current)).toMatchObject({
      spend: { amount: 3, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
      runs: 2,
      tasks: 2,
      mergedPullRequests: 1,
      closedPullRequests: 1,
      mergeRate: 0.5,
      costPerMerge: { amount: 3, currency: 'USD' },
      mergedTaskIds: ['task_1'],
    });
    expect(headlineOf(history, PERIOD.previous)).toMatchObject({
      spend: { amount: 50, currency: 'USD' },
      mergedPullRequests: 1,
      mergeRate: 1,
    });
  });

  it('prices neither the period nor its merges when the runs were priced in several currencies, saying so', () => {
    const history = historyOf({
      records: [
        costedRecord('run_1', {
          taskId: 'task_1',
          endedAt: day('2026-09-26'),
          amount: 1,
        }),
        costedRecord('run_2', {
          taskId: 'task_2',
          endedAt: day('2026-09-27'),
          amount: 2,
          currency: 'EUR',
        }),
        endedRecord('run_3', { taskId: 'task_3', endedAt: day('2026-09-27') }),
      ],
      deliveries: [
        deliveredOf('task_1', {
          openedAt: day('2026-09-26', 13),
          closedAt: day('2026-09-27'),
        }),
      ],
    });

    expect(headlineOf(history, PERIOD.current)).toMatchObject({
      spend: null,
      unpriced: 1,
      mixedCurrencies: true,
      costPerMerge: null,
    });
  });

  it('times each merge from its task opening', () => {
    const history = historyOf({
      deliveries: [
        deliveredOf('task_1', {
          openedAt: day('2026-09-26'),
          closedAt: day('2026-09-27', 10),
        }),
        deliveredOf('task_2', {
          openedAt: day('2026-09-26'),
          closedAt: day('2026-09-28', 10),
        }),
      ],
      touches: [
        touchesOf('task_1', { openedAt: day('2026-09-27', 8) }),
        touchesOf('task_2', { openedAt: day('2026-09-27', 10) }),
      ],
    });

    expect(headlineOf(history, PERIOD.current).taskToMerge).toEqual({
      p50: 46_800_000,
      p90: 86_400_000,
      count: 2,
    });
  });

  it('counts people’s touches per task worked, and who was active', () => {
    const history = historyOf({
      records: [
        endedRecord('run_1', { taskId: 'task_1', endedAt: day('2026-09-26') }),
        endedRecord('run_2', { taskId: 'task_2', endedAt: day('2026-09-26') }),
      ],
      touches: [
        touchesOf('task_1', {
          openedBy: 'user_ada',
          openedAt: day('2026-09-10'),
          acts: [
            ['answered', 'user_bob', 'station_1', day('2026-09-26', 13)],
            ['approved', 'user_bob', 'station_1', day('2026-09-26', 14)],
            ['closed', 'user_bob', 'station_1', day('2026-09-26', 15)],
          ],
        }),
        touchesOf('task_2', { openedBy: null }),
      ],
      chats: [chatOf('chat_1', 'user_cy', day('2026-09-30'))],
    });

    expect(headlineOf(history, PERIOD.current)).toMatchObject({
      touches: 3,
      touchesPerTask: 1.5,
      activePeople: 2,
      peopleIds: ['user_bob', 'user_cy'],
    });
  });

  it('prices nothing and rates nothing without runs or merges', () => {
    expect(headlineOf(historyOf({}), PERIOD.current)).toMatchObject({
      spend: null,
      mergeRate: null,
      costPerMerge: null,
      touchesPerTask: null,
      taskToMerge: { p50: null, p90: null, count: 0 },
    });
  });
});

const headline = (over: Partial<Headline> = {}): Headline => ({
  spend: { amount: 10, currency: 'USD' },
  unpriced: 0,
  mixedCurrencies: false,
  runs: 10,
  tasks: 5,
  mergedPullRequests: 4,
  closedPullRequests: 1,
  mergeRate: 0.8,
  costPerMerge: { amount: 2.5, currency: 'USD' },
  taskToMerge: { p50: 3_600_000, p90: 7_200_000, count: 4 },
  touches: 10,
  touchesPerTask: 2,
  activePeople: 3,
  mergedTaskIds: [],
  peopleIds: [],
  ...over,
});

describe('headlineChangesOf', () => {
  it('moves the merge rate by points and everything else by percent, each by its better direction', () => {
    const changes = headlineChangesOf(
      headline({
        spend: { amount: 15, currency: 'USD' },
        mergedPullRequests: 6,
        mergeRate: 0.6,
        costPerMerge: { amount: 2, currency: 'USD' },
        taskToMerge: { p50: 7_200_000, p90: null, count: 6 },
        touchesPerTask: 1,
      }),
      headline(),
    );

    expect(changes.spend).toMatchObject({ by: 0.5, tone: 'flat' });
    expect(changes.mergedPullRequests).toMatchObject({ by: 0.5, tone: 'good' });
    expect(changes.mergeRate).toMatchObject({
      unit: 'points',
      direction: 'down',
      tone: 'bad',
    });
    expect(changes.mergeRate?.by).toBeCloseTo(-0.2);
    expect(changes.costPerMerge).toMatchObject({ by: -0.2, tone: 'good' });
    expect(changes.taskToMerge).toMatchObject({ by: 1, tone: 'bad' });
    expect(changes.touchesPerTask).toMatchObject({ by: -0.5, tone: 'good' });
    expect(changes.activePeople?.direction).toBe('same');
  });

  it('compares no spend across currencies, nor a rate the period before did not have', () => {
    const changes = headlineChangesOf(
      headline({ spend: { amount: 15, currency: 'EUR' } }),
      headline({ mergeRate: null, costPerMerge: null }),
    );

    expect(changes.spend).toBeNull();
    expect(changes.mergeRate).toBeNull();
    expect(changes.costPerMerge).toBeNull();
  });
});
