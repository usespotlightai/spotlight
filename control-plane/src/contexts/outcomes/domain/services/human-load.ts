import { inboxWaitsWithin } from '@outcomes/domain/services/flow';
import {
  between,
  rateOf,
  type Spread,
  spreadOf,
} from '@outcomes/domain/services/measures';
import { runTally } from '@outcomes/domain/services/run-tally';
import {
  endedWithin,
  type TeamHistory,
  tasksOf,
} from '@outcomes/domain/services/team-history';
import {
  type Change,
  changeOf,
} from '@outcomes/domain/value-objects/change.vo';
import {
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';

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
  const tally = runTally(ended, history.deliveries);
  const waits = inboxWaitsWithin(history, window);
  const refusedIn = history.touches.filter((each) =>
    each.acts.some((act) => act.refuses && within(window, act.at)),
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
      each.acts.filter((act) => act.refuses && within(window, act.at)),
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

export interface HumanLoadChanges {
  readonly asksPerTask: Change | null;
  readonly toAnswer: Change | null;
  readonly sentBackRate: Change | null;
  readonly refused: Change | null;
}

export const humanLoadChangesOf = (
  now: HumanLoad,
  before: HumanLoad,
): HumanLoadChanges => ({
  asksPerTask: changeOf(now.asksPerTask, before.asksPerTask, {
    better: 'down',
    unit: 'percent',
  }),
  toAnswer: changeOf(now.toAnswer.p50, before.toAnswer.p50, {
    better: 'down',
    unit: 'percent',
  }),
  sentBackRate: changeOf(now.sentBackRate, before.sentBackRate, {
    better: 'down',
    unit: 'points',
  }),
  refused: changeOf(now.refused, before.refused, {
    better: 'down',
    unit: 'percent',
  }),
});
