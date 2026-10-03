import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { bootstrapped } from '@replays/domain/services/bootstrap';
import { taskSuccessesOf } from '@replays/domain/services/replay-results';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const DEFAULT_MIN_GAIN = 0.05;

export const GAIN_VERDICTS = ['better', 'worse', 'within-noise'] as const;

export type GainVerdict = (typeof GAIN_VERDICTS)[number];

export interface GainReading {
  readonly gain: number;
  readonly low: number;
  readonly high: number;
  readonly verdict: GainVerdict;
  readonly minGain: number;
  readonly tasks: number;
}

export interface PairedSuccess {
  readonly candidate: number;
  readonly baseline: number;
}

export const FEWEST_PAIRED_TASKS = 5;

const verdictOf = (
  gain: number,
  low: number,
  high: number,
  minGain: number,
  tasks: number,
): GainVerdict => {
  if (tasks < FEWEST_PAIRED_TASKS) {
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

export const gainReadingOf = (
  pairs: readonly PairedSuccess[],
  minGain: number,
  seed: string,
): GainReading | null => {
  const read = bootstrapped(
    pairs.map((each) => each.candidate - each.baseline),
    seed,
  );

  return (
    read && {
      gain: read.mean,
      low: read.low,
      high: read.high,
      verdict: verdictOf(read.mean, read.low, read.high, minGain, pairs.length),
      minGain,
      tasks: pairs.length,
    }
  );
};

export const gainBetween = (
  candidate: Replay,
  baseline: Replay,
  minGain: number,
  among: readonly RunId[] | null = null,
): GainReading | null => {
  const theirs = taskSuccessesOf(baseline, among);
  const pairs = [...taskSuccessesOf(candidate, among)].flatMap(
    ([original, success]) => {
      const against = theirs.get(original);

      return against === undefined
        ? []
        : [{ candidate: success, baseline: against }];
    },
  );

  return gainReadingOf(
    pairs,
    minGain,
    `${candidate.id.value}:${baseline.id.value}`,
  );
};
