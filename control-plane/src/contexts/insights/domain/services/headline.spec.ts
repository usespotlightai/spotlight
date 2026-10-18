import {
  chatOf,
  day,
  historyOf,
  humanActionsOf,
  taskPullRequestOf,
} from '@insights/domain/insights.fake-spec';
import { costedRecord, endedRecord } from '@insights/domain/runs.fake-spec';
import {
  type Headline,
  headlineCountsOf,
  headlineDeltasOf,
  headlineFrom,
  resolvedDeliveriesOf,
} from '@insights/domain/services/headline';
import {
  openingsOf,
  type TeamHistory,
} from '@insights/domain/services/team-history';
import {
  InsightsPeriod,
  type Window,
} from '@insights/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

const headlineOf = (history: TeamHistory, window: Window): Headline =>
  headlineFrom(
    headlineCountsOf(history, window),
    resolvedDeliveriesOf(history, openingsOf(history.taskHumanActions)),
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
          ending: 'cancelled',
        }),
      ],
      taskPullRequests: [
        taskPullRequestOf('task_1', {
          openedAt: day('2026-09-26', 13),
          closedAt: day('2026-09-27'),
        }),
        taskPullRequestOf('task_2', {
          openedAt: day('2026-09-27', 13),
          closedAt: day('2026-09-29'),
          merged: false,
        }),
        taskPullRequestOf('task_3', {
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
      taskPullRequests: [
        taskPullRequestOf('task_1', {
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
      taskPullRequests: [
        taskPullRequestOf('task_1', {
          openedAt: day('2026-09-26'),
          closedAt: day('2026-09-27', 10),
        }),
        taskPullRequestOf('task_2', {
          openedAt: day('2026-09-26'),
          closedAt: day('2026-09-28', 10),
        }),
      ],
      taskHumanActions: [
        humanActionsOf('task_1', { openedAt: day('2026-09-27', 8) }),
        humanActionsOf('task_2', { openedAt: day('2026-09-27', 10) }),
      ],
    });

    expect(headlineOf(history, PERIOD.current).taskToMerge).toEqual({
      p50: 46_800_000,
      p90: 86_400_000,
      count: 2,
    });
  });

  it('counts the human actions per task worked, and who was active', () => {
    const history = historyOf({
      records: [
        endedRecord('run_1', { taskId: 'task_1', endedAt: day('2026-09-26') }),
        endedRecord('run_2', { taskId: 'task_2', endedAt: day('2026-09-26') }),
      ],
      taskHumanActions: [
        humanActionsOf('task_1', {
          openedBy: 'user_ada',
          openedAt: day('2026-09-10'),
          actions: [
            ['answered', 'user_bob', 'station_1', day('2026-09-26', 13)],
            ['approved', 'user_bob', 'station_1', day('2026-09-26', 14)],
            ['accepted', 'user_bob', 'station_1', day('2026-09-26', 15)],
          ],
        }),
        humanActionsOf('task_2', { openedBy: null }),
      ],
      chats: [chatOf('chat_1', 'user_cy', day('2026-09-30'))],
    });

    expect(headlineOf(history, PERIOD.current)).toMatchObject({
      humanActions: 3,
      humanActionsPerTask: 1.5,
      activePeople: 2,
      peopleIds: ['user_bob', 'user_cy'],
    });
  });

  it('prices nothing and rates nothing without runs or merges', () => {
    expect(headlineOf(historyOf({}), PERIOD.current)).toMatchObject({
      spend: null,
      mergeRate: null,
      costPerMerge: null,
      humanActionsPerTask: null,
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
  humanActions: 10,
  humanActionsPerTask: 2,
  activePeople: 3,
  mergedTaskIds: [],
  peopleIds: [],
  ...over,
});

describe('headlineDeltasOf', () => {
  it('moves the merge rate by points and everything else by percent, each by its better direction', () => {
    const changes = headlineDeltasOf(
      headline({
        spend: { amount: 15, currency: 'USD' },
        mergedPullRequests: 6,
        mergeRate: 0.6,
        costPerMerge: { amount: 2, currency: 'USD' },
        taskToMerge: { p50: 7_200_000, p90: null, count: 6 },
        humanActionsPerTask: 1,
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
    expect(changes.humanActionsPerTask).toMatchObject({
      by: -0.5,
      tone: 'good',
    });
    expect(changes.activePeople?.direction).toBe('same');
  });

  it('compares no spend across currencies, nor a rate the period before did not have', () => {
    const changes = headlineDeltasOf(
      headline({ spend: { amount: 15, currency: 'EUR' } }),
      headline({ mergeRate: null, costPerMerge: null }),
    );

    expect(changes.spend).toBeNull();
    expect(changes.mergeRate).toBeNull();
    expect(changes.costPerMerge).toBeNull();
  });
});
