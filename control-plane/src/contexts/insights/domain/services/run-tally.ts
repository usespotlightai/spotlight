import {
  medianOf,
  percentileOf,
  rateOf,
  spendingOf,
} from '@insights/domain/services/measures';
import {
  type Delta,
  deltaOf,
  spendDeltaOf,
} from '@insights/domain/value-objects/delta.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { RunResolution } from '@insights/domain/value-objects/run-resolution';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';

export interface RunTally {
  readonly runs: number;
  readonly cancelled: number;
  readonly failed: number;
  readonly failedRate: number | null;
  readonly stopped: number;
  readonly checksPassed: number;
  readonly checksFailed: number;
  readonly resolutions: ResolutionCounts;
  readonly resolutionShares: ResolutionShares;
  readonly passed: number;
  readonly merged: number;
  readonly cost: Money | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly medianMs: number | null;
  readonly p90Ms: number | null;
}

export interface ResolutionCounts {
  readonly accepted: number;
  readonly sentBack: number;
  readonly movedOn: number;
  readonly failed: number;
  readonly other: number;
}

export interface ResolutionShares {
  readonly accepted: number | null;
  readonly sentBack: number | null;
  readonly movedOn: number | null;
  readonly failed: number | null;
  readonly other: number | null;
}

const count = (
  facts: readonly RunFact[],
  matches: (fact: RunFact) => boolean,
): number => facts.filter(matches).length;

export const runTally = (facts: readonly RunFact[]): RunTally => {
  const ran = facts.filter((each) => each.ran);
  const spending = spendingOf(ran.map((each) => each.usage?.spend ?? null));
  const took = ran.flatMap((each) =>
    each.usage?.ms === null || each.usage?.ms === undefined
      ? []
      : [each.usage.ms],
  );
  const countOf = (resolution: RunResolution) =>
    count(ran, (each) => each.resolution === resolution);

  return tallyOf({
    runs: ran.length,
    cancelled: count(facts, (each) => !each.ran),
    failed: count(ran, (each) => each.ending === 'failed'),
    stopped: count(ran, (each) => each.ending === 'stopped'),
    checksPassed: count(ran, (each) => each.checks === 'passed'),
    checksFailed: count(ran, (each) => each.checks === 'failed'),
    resolutions: {
      accepted: countOf('accepted'),
      sentBack: countOf('sent-back'),
      movedOn: countOf('moved-on'),
      failed: countOf('failed'),
      other: countOf('other'),
    },
    passed: count(ran, (each) => each.passed !== null),
    merged: new Set(
      ran.filter((each) => each.merged).map((each) => each.taskId.value),
    ).size,
    cost: spending.spend,
    unpriced: spending.unpriced,
    mixedCurrencies: spending.mixedCurrencies,
    medianMs: medianOf(took),
    p90Ms: percentileOf(took, 90),
  });
};

export type TallyCounts = Omit<RunTally, 'failedRate' | 'resolutionShares'>;

export const NO_RUNS: TallyCounts = {
  runs: 0,
  cancelled: 0,
  failed: 0,
  stopped: 0,
  checksPassed: 0,
  checksFailed: 0,
  resolutions: { accepted: 0, sentBack: 0, movedOn: 0, failed: 0, other: 0 },
  passed: 0,
  merged: 0,
  cost: null,
  unpriced: 0,
  mixedCurrencies: false,
  medianMs: null,
  p90Ms: null,
};

export const tallyOf = (counts: TallyCounts): RunTally => ({
  runs: counts.runs,
  cancelled: counts.cancelled,
  failed: counts.failed,
  failedRate: rateOf(counts.failed, counts.runs),
  stopped: counts.stopped,
  checksPassed: counts.checksPassed,
  checksFailed: counts.checksFailed,
  resolutions: counts.resolutions,
  resolutionShares: {
    accepted: rateOf(counts.resolutions.accepted, counts.runs),
    sentBack: rateOf(counts.resolutions.sentBack, counts.runs),
    movedOn: rateOf(counts.resolutions.movedOn, counts.runs),
    failed: rateOf(counts.resolutions.failed, counts.runs),
    other: rateOf(counts.resolutions.other, counts.runs),
  },
  passed: counts.passed,
  merged: counts.merged,
  cost: counts.cost,
  unpriced: counts.unpriced,
  mixedCurrencies: counts.mixedCurrencies,
  medianMs: counts.medianMs,
  p90Ms: counts.p90Ms,
});

export interface ResolutionDeltas {
  readonly accepted: Delta | null;
  readonly sentBack: Delta | null;
  readonly movedOn: Delta | null;
  readonly failed: Delta | null;
  readonly other: Delta | null;
}

export interface TallyDeltas {
  readonly runs: Delta | null;
  readonly failed: Delta | null;
  readonly resolutions: ResolutionDeltas;
  readonly merged: Delta | null;
  readonly cost: Delta | null;
  readonly median: Delta | null;
}

export const tallyDeltasOf = (
  now: RunTally,
  before: RunTally,
): TallyDeltas => ({
  runs: deltaOf(now.runs, before.runs, { better: 'neither', unit: 'percent' }),
  failed: deltaOf(now.failed, before.failed, {
    better: 'down',
    unit: 'percent',
  }),
  resolutions: {
    accepted: deltaOf(now.resolutions.accepted, before.resolutions.accepted, {
      better: 'up',
      unit: 'percent',
    }),
    sentBack: deltaOf(now.resolutions.sentBack, before.resolutions.sentBack, {
      better: 'down',
      unit: 'percent',
    }),
    movedOn: deltaOf(now.resolutions.movedOn, before.resolutions.movedOn, {
      better: 'neither',
      unit: 'percent',
    }),
    failed: deltaOf(now.resolutions.failed, before.resolutions.failed, {
      better: 'down',
      unit: 'percent',
    }),
    other: deltaOf(now.resolutions.other, before.resolutions.other, {
      better: 'neither',
      unit: 'percent',
    }),
  },
  merged: deltaOf(now.merged, before.merged, {
    better: 'up',
    unit: 'percent',
  }),
  cost: spendDeltaOf(now.cost, before.cost, 'neither'),
  median: deltaOf(now.medianMs, before.medianMs, {
    better: 'down',
    unit: 'percent',
  }),
});

export interface TallySeen {
  readonly accepted: boolean;
  readonly sentBack: boolean;
  readonly merged: boolean;
}

export const tallySeenOf = (now: RunTally, before: RunTally): TallySeen => ({
  accepted: now.resolutions.accepted > 0 || before.resolutions.accepted > 0,
  sentBack: now.resolutions.sentBack > 0 || before.resolutions.sentBack > 0,
  merged: now.merged > 0 || before.merged > 0,
});

export interface TallyRates {
  readonly checksPassed: number | null;
  readonly merged: number | null;
}

export const tallyRatesOf = (tally: RunTally): TallyRates => ({
  checksPassed: rateOf(
    tally.checksPassed,
    tally.checksPassed + tally.checksFailed,
  ),
  merged: rateOf(tally.merged, tally.runs),
});

const COUNTED_IN_TALLY = [
  'failed',
  'stopped',
  'checksPassed',
  'checksFailed',
  'accepted',
  'sentBack',
  'passed',
  'merged',
  'cancelled',
] as const;

export type TallyCounted = Readonly<
  Record<(typeof COUNTED_IN_TALLY)[number], boolean>
>;

export const tallyCountedOf = (tally: RunTally): TallyCounted => ({
  failed: tally.failed > 0,
  stopped: tally.stopped > 0,
  checksPassed: tally.checksPassed > 0,
  checksFailed: tally.checksFailed > 0,
  accepted: tally.resolutions.accepted > 0,
  sentBack: tally.resolutions.sentBack > 0,
  passed: tally.passed > 0,
  merged: tally.merged > 0,
  cancelled: tally.cancelled > 0,
});
