import type { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import {
  activitiesOf,
  peopleActiveIn,
} from '@insights/domain/services/adoption';
import {
  between,
  rateOf,
  type Spread,
  spendingOf,
  spreadOf,
} from '@insights/domain/services/measures';
import {
  endedWithin,
  type TeamHistory,
  tasksOf,
} from '@insights/domain/services/team-history';
import {
  type Delta,
  deltaOf,
  spendDeltaOf,
} from '@insights/domain/value-objects/delta.vo';
import {
  type Window,
  within,
} from '@insights/domain/value-objects/insights-period.vo';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';

export interface Headline {
  readonly spend: Money | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly runs: number;
  readonly tasks: number;
  readonly mergedPullRequests: number;
  readonly closedPullRequests: number;
  readonly mergeRate: number | null;
  readonly costPerMerge: Money | null;
  readonly taskToMerge: Spread;
  readonly humanActions: number;
  readonly humanActionsPerTask: number | null;
  readonly activePeople: number;
  readonly mergedTaskIds: readonly string[];
  readonly peopleIds: readonly string[];
}

export interface HeadlineCounts {
  readonly runs: number;
  readonly tasks: number;
  readonly spend: Money | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly humanActions: number;
  readonly people: readonly string[];
}

export interface ResolvedDelivery {
  readonly taskId: string;
  readonly merged: boolean;
  readonly closedAt: Date;
  readonly taskOpenedAt: Date | null;
}

export const headlineCountsOf = (
  history: TeamHistory,
  window: Window,
): HeadlineCounts => {
  const ended = endedWithin(history.records, window).filter((each) => each.ran);
  const tasks = tasksOf(ended);
  const worked = new Set(tasks);
  const { spend, unpriced, mixedCurrencies } = spendingOf(
    ended.map((each) => each.usage?.spend ?? null),
  );

  return {
    runs: ended.length,
    tasks: tasks.length,
    spend,
    unpriced,
    mixedCurrencies,
    humanActions: history.taskHumanActions
      .filter((each) => worked.has(each.taskId.value))
      .flatMap((each) => each.actions)
      .filter((action) => within(window, action.at)).length,
    people: peopleActiveIn(activitiesOf(history), window),
  };
};

export const resolvedDeliveriesOf = (
  history: TeamHistory,
  openings: ReadonlyMap<string, TaskHumanActions>,
): readonly ResolvedDelivery[] =>
  history.taskPullRequests.flatMap((each) =>
    each.state !== 'open' && each.closedAt
      ? [
          {
            taskId: each.taskId.value,
            merged: each.merged,
            closedAt: each.closedAt,
            taskOpenedAt: openings.get(each.taskId.value)?.opening?.at ?? null,
          },
        ]
      : [],
  );

export const headlineFrom = (
  counts: HeadlineCounts,
  resolved: readonly ResolvedDelivery[],
  window: Window,
): Headline => {
  const closed = resolved.filter((each) => within(window, each.closedAt));
  const merged = closed.filter((each) => each.merged);
  const { spend } = counts;

  return {
    spend,
    unpriced: counts.unpriced,
    mixedCurrencies: counts.mixedCurrencies,
    runs: counts.runs,
    tasks: counts.tasks,
    mergedPullRequests: merged.length,
    closedPullRequests: closed.length - merged.length,
    mergeRate: rateOf(merged.length, closed.length),
    costPerMerge:
      spend && merged.length > 0
        ? { amount: spend.amount / merged.length, currency: spend.currency }
        : null,
    taskToMerge: spreadOf(
      merged.flatMap((each) =>
        each.taskOpenedAt ? [between(each.taskOpenedAt, each.closedAt)] : [],
      ),
    ),
    humanActions: counts.humanActions,
    humanActionsPerTask: rateOf(counts.humanActions, counts.tasks),
    activePeople: counts.people.length,
    mergedTaskIds: merged.map((each) => each.taskId),
    peopleIds: counts.people,
  };
};

export interface HeadlineDeltas {
  readonly spend: Delta | null;
  readonly mergedPullRequests: Delta | null;
  readonly mergeRate: Delta | null;
  readonly costPerMerge: Delta | null;
  readonly taskToMerge: Delta | null;
  readonly humanActionsPerTask: Delta | null;
  readonly activePeople: Delta | null;
}

export const headlineDeltasOf = (
  now: Headline,
  before: Headline,
): HeadlineDeltas => ({
  spend: spendDeltaOf(now.spend, before.spend, 'neither'),
  mergedPullRequests: deltaOf(
    now.mergedPullRequests,
    before.mergedPullRequests,
    { better: 'up', unit: 'percent' },
  ),
  mergeRate: deltaOf(now.mergeRate, before.mergeRate, {
    better: 'up',
    unit: 'points',
  }),
  costPerMerge: spendDeltaOf(now.costPerMerge, before.costPerMerge, 'down'),
  taskToMerge: deltaOf(now.taskToMerge.p50, before.taskToMerge.p50, {
    better: 'down',
    unit: 'percent',
  }),
  humanActionsPerTask: deltaOf(
    now.humanActionsPerTask,
    before.humanActionsPerTask,
    {
      better: 'down',
      unit: 'percent',
    },
  ),
  activePeople: deltaOf(now.activePeople, before.activePeople, {
    better: 'up',
    unit: 'percent',
  }),
});
