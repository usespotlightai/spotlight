import type { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import {
  activitiesOf,
  peopleActiveIn,
} from '@outcomes/domain/services/adoption';
import {
  between,
  rateOf,
  type Spread,
  spendingOf,
  spreadOf,
} from '@outcomes/domain/services/measures';
import {
  endedWithin,
  type TeamHistory,
  tasksOf,
} from '@outcomes/domain/services/team-history';
import {
  type Change,
  changeOf,
  spendChangeOf,
} from '@outcomes/domain/value-objects/change.vo';
import {
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

export interface Headline {
  readonly spend: Spend | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly runs: number;
  readonly tasks: number;
  readonly mergedPullRequests: number;
  readonly closedPullRequests: number;
  readonly mergeRate: number | null;
  readonly costPerMerge: Spend | null;
  readonly taskToMerge: Spread;
  readonly touches: number;
  readonly touchesPerTask: number | null;
  readonly activePeople: number;
  readonly mergedTaskIds: readonly string[];
  readonly peopleIds: readonly string[];
}

export interface HeadlineCounts {
  readonly runs: number;
  readonly tasks: number;
  readonly spend: Spend | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly touches: number;
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
    ended.map((each) => each.cost?.spend ?? null),
  );

  return {
    runs: ended.length,
    tasks: tasks.length,
    spend,
    unpriced,
    mixedCurrencies,
    touches: history.touches
      .filter((each) => worked.has(each.taskId.value))
      .flatMap((each) => each.acts)
      .filter((act) => within(window, act.at)).length,
    people: peopleActiveIn(activitiesOf(history), window),
  };
};

export const resolvedDeliveriesOf = (
  history: TeamHistory,
  openings: ReadonlyMap<string, TaskTouches>,
): readonly ResolvedDelivery[] =>
  history.deliveries.flatMap((each) =>
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
    touches: counts.touches,
    touchesPerTask: rateOf(counts.touches, counts.tasks),
    activePeople: counts.people.length,
    mergedTaskIds: merged.map((each) => each.taskId),
    peopleIds: counts.people,
  };
};

export interface HeadlineChanges {
  readonly spend: Change | null;
  readonly mergedPullRequests: Change | null;
  readonly mergeRate: Change | null;
  readonly costPerMerge: Change | null;
  readonly taskToMerge: Change | null;
  readonly touchesPerTask: Change | null;
  readonly activePeople: Change | null;
}

export const headlineChangesOf = (
  now: Headline,
  before: Headline,
): HeadlineChanges => ({
  spend: spendChangeOf(now.spend, before.spend, 'neither'),
  mergedPullRequests: changeOf(
    now.mergedPullRequests,
    before.mergedPullRequests,
    { better: 'up', unit: 'percent' },
  ),
  mergeRate: changeOf(now.mergeRate, before.mergeRate, {
    better: 'up',
    unit: 'points',
  }),
  costPerMerge: spendChangeOf(now.costPerMerge, before.costPerMerge, 'down'),
  taskToMerge: changeOf(now.taskToMerge.p50, before.taskToMerge.p50, {
    better: 'down',
    unit: 'percent',
  }),
  touchesPerTask: changeOf(now.touchesPerTask, before.touchesPerTask, {
    better: 'down',
    unit: 'percent',
  }),
  activePeople: changeOf(now.activePeople, before.activePeople, {
    better: 'up',
    unit: 'percent',
  }),
});
