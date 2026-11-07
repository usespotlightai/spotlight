import { rateOf, type Spread } from '@insights/domain/services/measures';
import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';

export interface HumanLoad {
  readonly asks: number;
  readonly tasks: number;
  readonly asksPerTask: number | null;
  readonly toAnswer: Spread;
  readonly unanswered: number;
  readonly sentBack: number;
  readonly sentBackRate: number | null;
  readonly dismissed: number;
  readonly askedTaskIds: readonly string[];
  readonly dismissedTaskIds: readonly string[];
}

export interface HumanLoadCounts {
  readonly asks: number;
  readonly unanswered: number;
  readonly toAnswer: Spread;
  readonly askedTaskIds: readonly string[];
  readonly tasks: number;
  readonly runs: number;
  readonly sentBack: number;
  readonly dismissed: number;
  readonly dismissedTaskIds: readonly string[];
}

export const humanLoadFrom = (counts: HumanLoadCounts): HumanLoad => ({
  asks: counts.asks,
  tasks: counts.tasks,
  asksPerTask: rateOf(counts.asks, counts.tasks),
  toAnswer: counts.toAnswer,
  unanswered: counts.unanswered,
  sentBack: counts.sentBack,
  sentBackRate: rateOf(counts.sentBack, counts.runs),
  dismissed: counts.dismissed,
  askedTaskIds: counts.askedTaskIds,
  dismissedTaskIds: counts.dismissedTaskIds,
});

export interface HumanLoadDeltas {
  readonly asksPerTask: Delta | null;
  readonly toAnswer: Delta | null;
  readonly sentBackRate: Delta | null;
  readonly dismissed: Delta | null;
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
  dismissed: deltaOf(now.dismissed, before.dismissed, {
    better: 'down',
    unit: 'percent',
  }),
});
