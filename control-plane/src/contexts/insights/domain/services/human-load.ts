import { inboxWaitsWithin } from '@insights/domain/services/flow';
import {
  between,
  rateOf,
  type Spread,
  spreadOf,
} from '@insights/domain/services/measures';
import { runTally } from '@insights/domain/services/run-tally';
import {
  endedWithin,
  type TeamHistory,
  tasksOf,
} from '@insights/domain/services/team-history';
import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';
import {
  type Window,
  within,
} from '@insights/domain/value-objects/insights-period.vo';

export interface HumanLoad {
  readonly asks: number;
  readonly tasks: number;
  readonly asksPerTask: number | null;
  readonly toAnswer: Spread;
  readonly unanswered: number;
  readonly sentBack: number;
  readonly sentBackRate: number | null;
  readonly refused: number;
  readonly askedTaskIds: readonly string[];
  readonly refusedTaskIds: readonly string[];
}

export interface HumanLoadCounts {
  readonly asks: number;
  readonly unanswered: number;
  readonly toAnswer: Spread;
  readonly askedTaskIds: readonly string[];
  readonly tasks: number;
  readonly runs: number;
  readonly sentBack: number;
  readonly refused: number;
  readonly refusedTaskIds: readonly string[];
}

export const humanLoadCountsOf = (
  history: TeamHistory,
  window: Window,
): HumanLoadCounts => {
  const ended = endedWithin(history.records, window);
  const tally = runTally(ended, history.taskPullRequests);
  const waits = inboxWaitsWithin(history, window);
  const refusedIn = history.taskHumanActions.filter((each) =>
    each.actions.some((action) => action.refuses && within(window, action.at)),
  );

  return {
    asks: waits.length,
    unanswered: waits.filter((each) => each.answeredAt === null).length,
    toAnswer: spreadOf(
      waits.flatMap((each) =>
        each.answeredAt ? [between(each.askedAt, each.answeredAt)] : [],
      ),
    ),
    askedTaskIds: [...new Set(waits.map((each) => each.taskId))],
    tasks: tasksOf(ended.filter((each) => each.ran)).length,
    runs: tally.runs,
    sentBack: tally.sentBack,
    refused: refusedIn.flatMap((each) =>
      each.actions.filter(
        (action) => action.refuses && within(window, action.at),
      ),
    ).length,
    refusedTaskIds: refusedIn.map((each) => each.taskId.value),
  };
};

export const humanLoadFrom = (counts: HumanLoadCounts): HumanLoad => ({
  asks: counts.asks,
  tasks: counts.tasks,
  asksPerTask: rateOf(counts.asks, counts.tasks),
  toAnswer: counts.toAnswer,
  unanswered: counts.unanswered,
  sentBack: counts.sentBack,
  sentBackRate: rateOf(counts.sentBack, counts.runs),
  refused: counts.refused,
  askedTaskIds: counts.askedTaskIds,
  refusedTaskIds: counts.refusedTaskIds,
});

export interface HumanLoadDeltas {
  readonly asksPerTask: Delta | null;
  readonly toAnswer: Delta | null;
  readonly sentBackRate: Delta | null;
  readonly refused: Delta | null;
}

export const humanLoadDeltasOf = (
  now: HumanLoad,
  before: HumanLoad,
): HumanLoadDeltas => ({
  asksPerTask: deltaOf(now.asksPerTask, before.asksPerTask, {
    better: 'down',
    unit: 'percent',
  }),
  toAnswer: deltaOf(now.toAnswer.p50, before.toAnswer.p50, {
    better: 'down',
    unit: 'percent',
  }),
  sentBackRate: deltaOf(now.sentBackRate, before.sentBackRate, {
    better: 'down',
    unit: 'points',
  }),
  refused: deltaOf(now.refused, before.refused, {
    better: 'down',
    unit: 'percent',
  }),
});
