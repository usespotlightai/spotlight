import {
  between,
  rateOf,
  type Spread,
  spreadOf,
} from '@insights/domain/services/measures';
import {
  finishedWithin,
  type PullRequestDelivery,
  tasksOf,
} from '@insights/domain/services/pull-request-delivery';
import {
  type Delta,
  deltaOf,
  spendDeltaOf,
} from '@insights/domain/value-objects/delta.vo';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';
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

export const headlineFrom = (
  counts: HeadlineCounts,
  deliveries: readonly PullRequestDelivery[],
  window: Window,
): Headline => {
  const finished = deliveries.filter((each) => finishedWithin(window, each));
  const merged = finished.filter((each) => each.merged);
  const { spend } = counts;

  return {
    spend,
    unpriced: counts.unpriced,
    mixedCurrencies: counts.mixedCurrencies,
    runs: counts.runs,
    tasks: counts.tasks,
    mergedPullRequests: merged.length,
    closedPullRequests: finished.length - merged.length,
    mergeRate: rateOf(merged.length, finished.length),
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
    mergedTaskIds: tasksOf(merged),
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
