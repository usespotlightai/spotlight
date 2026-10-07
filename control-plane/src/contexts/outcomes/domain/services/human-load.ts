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

export const humanLoadOf = (
  history: TeamHistory,
  window: Window,
): HumanLoad => {
  const ended = endedWithin(history.records, window);
  const tally = runTally(ended, history.deliveries);
  const tasks = tasksOf(ended.filter((each) => each.ran)).length;
  const waits = inboxWaitsWithin(history, window);
  const refusedIn = history.touches.filter((each) =>
    each.acts.some((act) => act.refuses && within(window, act.at)),
  );

  return {
    asks: waits.length,
    tasks,
    asksPerTask: rateOf(waits.length, tasks),
    toAnswer: spreadOf(
      waits.flatMap((each) =>
        each.answeredAt ? [between(each.askedAt, each.answeredAt)] : [],
      ),
    ),
    unanswered: waits.filter((each) => each.answeredAt === null).length,
    sentBack: tally.sentBack,
    sentBackRate: rateOf(tally.sentBack, tally.runs),
    refused: refusedIn.flatMap((each) =>
      each.acts.filter((act) => act.refuses && within(window, act.at)),
    ).length,
    askedTaskIds: [...new Set(waits.map((each) => each.taskId))],
    refusedTaskIds: refusedIn.map((each) => each.taskId.value),
  };
};

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
