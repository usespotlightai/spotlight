import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { bootstrapped } from '@replays/domain/services/bootstrap';
import { taskSuccessesOf } from '@replays/domain/services/replay-results';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const DEFAULT_MIN_GAIN = 0.05;

export const GAIN_SIGNIFICANCES = ['better', 'worse', 'within-noise'] as const;

export type GainSignificance = (typeof GAIN_SIGNIFICANCES)[number];

export interface GainEstimate {
  readonly gain: number;
  readonly low: number;
  readonly high: number;
  readonly significance: GainSignificance;
  readonly minGain: number;
  readonly tasks: number;
}

export interface PairedSuccess {
  readonly candidate: number;
  readonly baseline: number;
}

export const MIN_PAIRED_TASKS = 5;

const significanceOf = (
  gain: number,
  low: number,
  high: number,
  minGain: number,
  tasks: number,
): GainSignificance => {
  if (tasks < MIN_PAIRED_TASKS) {
    return 'within-noise';
  }
  if (low > 0 && gain >= minGain) {
    return 'better';
  }
  if (high < 0 && -gain >= minGain) {
    return 'worse';
  }

  return 'within-noise';
};

export const gainEstimateOf = (
  pairs: readonly PairedSuccess[],
  minGain: number,
  seed: string,
): GainEstimate | null => {
  const read = bootstrapped(
    pairs.map((each) => each.candidate - each.baseline),
    seed,
  );

  return (
    read && {
      gain: read.mean,
      low: read.low,
      high: read.high,
      significance: significanceOf(
        read.mean,
        read.low,
        read.high,
        minGain,
        pairs.length,
      ),
      minGain,
      tasks: pairs.length,
    }
  );
};

export const gainBetween = (
  candidate: Replay,
  baseline: Replay,
  minGain: number,
  runSubset: readonly RunId[] | null = null,
): GainEstimate | null => {
  const theirs = taskSuccessesOf(baseline, runSubset);
  const pairs = [...taskSuccessesOf(candidate, runSubset)].flatMap(
    ([original, success]) => {
      const against = theirs.get(original);

      return against === undefined
        ? []
        : [{ candidate: success, baseline: against }];
    },
  );

  return gainEstimateOf(
    pairs,
    minGain,
    `${candidate.id.value}:${baseline.id.value}`,
  );
};
