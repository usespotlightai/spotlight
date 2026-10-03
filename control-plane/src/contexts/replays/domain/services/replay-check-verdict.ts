import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import {
  type GainReading,
  gainBetween,
} from '@replays/domain/services/gain-reading';
import {
  comparedWith,
  type EntryComparison,
  type ReplayTotals,
  totalsOf,
} from '@replays/domain/services/replay-results';

export const CHECK_VERDICTS = [
  'running',
  'passed',
  'failed',
  'undecided',
] as const;

export type CheckVerdict = (typeof CHECK_VERDICTS)[number];

export const UNDECIDED_BECAUSE = [
  'replay-gone',
  'stopped',
  'over-ceiling',
  'baseline-unfinished',
  'no-baseline',
  'too-few-scored',
] as const;

export type UndecidedBecause = (typeof UNDECIDED_BECAUSE)[number];

export interface CheckReading {
  readonly verdict: CheckVerdict;
  readonly because: UndecidedBecause | null;
  readonly entries: number;
  readonly compared: number;
  readonly regressions: readonly EntryComparison[];
  readonly candidate: ReplayTotals | null;
  readonly baseline: ReplayTotals | null;
  readonly gain: GainReading | null;
}

const UNDERWAY: readonly string[] = ['queued', 'running'];

const isScored = (each: EntryComparison): boolean =>
  each.candidateSuccess !== null && each.baselineSuccess !== null;

const undecidedBecause = (
  replay: Replay,
  baseline: Replay | null,
  entries: number,
  compared: number,
): UndecidedBecause | null => {
  if (replay.current === 'stopped') {
    return 'stopped';
  }
  if (replay.current === 'over-budget') {
    return 'over-ceiling';
  }
  if (!baseline) {
    return 'no-baseline';
  }
  if (baseline.current !== 'finished') {
    return 'baseline-unfinished';
  }

  return compared * 2 < entries ? 'too-few-scored' : null;
};

export const readingOf = (
  check: ReplayCheck,
  replay: Replay | null,
  baseline: Replay | null,
  awaitingBaseline: boolean,
): CheckReading => {
  if (!replay) {
    return {
      verdict: 'undecided',
      because: 'replay-gone',
      entries: 0,
      compared: 0,
      regressions: [],
      candidate: null,
      baseline: baseline && totalsOf(baseline),
      gain: null,
    };
  }

  const compared = comparedWith(replay, baseline);
  const regressions = compared.filter((each) => each.regressed);
  const scored = compared.filter(isScored).length;
  const entries = compared.length;
  const reading = {
    entries,
    compared: scored,
    regressions,
    candidate: totalsOf(replay),
    baseline: baseline && totalsOf(baseline),
    gain: baseline && gainBetween(replay, baseline, check.threshold.minGain),
  };

  if (!check.threshold.allows(regressions.length)) {
    return { ...reading, verdict: 'failed', because: null };
  }
  if (
    UNDERWAY.includes(replay.current) ||
    (baseline === null && awaitingBaseline && replay.current === 'finished') ||
    (baseline !== null && UNDERWAY.includes(baseline.current))
  ) {
    return { ...reading, verdict: 'running', because: null };
  }

  const because = undecidedBecause(replay, baseline, entries, scored);

  return because
    ? { ...reading, verdict: 'undecided', because }
    : { ...reading, verdict: 'passed', because: null };
};
