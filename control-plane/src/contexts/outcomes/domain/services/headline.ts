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
  openingsOf,
  type TeamHistory,
  tasksOf,
} from '@outcomes/domain/services/team-history';
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

export const headlineOf = (history: TeamHistory, window: Window): Headline => {
  const ended = endedWithin(history.records, window).filter((each) => each.ran);
  const tasks = tasksOf(ended);
  const worked = new Set(tasks);
  const resolved = history.deliveries.filter(
    (each) => each.state !== 'open' && within(window, each.closedAt),
  );
  const merged = resolved.filter((each) => each.merged);
  const { spend, unpriced, mixedCurrencies } = spendingOf(
    ended.map((each) => each.cost?.spend ?? null),
  );
  const openings = openingsOf(history.touches);
  const touches = history.touches
    .filter((each) => worked.has(each.taskId.value))
    .flatMap((each) => each.acts)
    .filter((act) => within(window, act.at)).length;
  const people = peopleActiveIn(activitiesOf(history), window);

  return {
    spend,
    unpriced,
    mixedCurrencies,
    runs: ended.length,
    tasks: tasks.length,
    mergedPullRequests: merged.length,
    closedPullRequests: resolved.length - merged.length,
    mergeRate: rateOf(merged.length, resolved.length),
    costPerMerge:
      spend && merged.length > 0
        ? { amount: spend.amount / merged.length, currency: spend.currency }
        : null,
    taskToMerge: spreadOf(
      merged.flatMap((delivery) => {
        const opened = openings.get(delivery.taskId.value)?.opening?.at;

        return opened && delivery.closedAt
          ? [between(opened, delivery.closedAt)]
          : [];
      }),
    ),
    touches,
    touchesPerTask: rateOf(touches, tasks.length),
    activePeople: people.length,
    mergedTaskIds: merged.map((each) => each.taskId.value),
    peopleIds: people,
  };
};
