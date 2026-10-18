import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import {
  type GainEstimate,
  gainBetween,
} from '@replays/domain/services/gain-estimate';
import {
  type EntryComparison,
  type ReplayTotals,
  taskComparisons,
  totalsOf,
} from '@replays/domain/services/replay-results';

export const CHECK_RESULTS = [
  'running',
  'passed',
  'failed',
  'undecided',
] as const;

export type CheckResult = (typeof CHECK_RESULTS)[number];

export const UNDECIDED_BECAUSE = [
  'replay-gone',
  'stopped',
  'over-ceiling',
  'baseline-unfinished',
  'no-baseline',
  'too-few-scored',
] as const;

export type UndecidedBecause = (typeof UNDECIDED_BECAUSE)[number];

export interface CheckEvaluation {
  readonly result: CheckResult;
  readonly because: UndecidedBecause | null;
  readonly entries: number;
  readonly compared: number;
  readonly regressions: readonly EntryComparison[];
  readonly candidate: ReplayTotals | null;
  readonly baseline: ReplayTotals | null;
  readonly gain: GainEstimate | null;
}

const IN_PROGRESS: readonly string[] = ['queued', 'running'];

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
  if (replay.current === 'ceiling-reached') {
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

export const evaluationOf = (
  check: ReplayCheck,
  replay: Replay | null,
  baseline: Replay | null,
  awaitingBaseline: boolean,
): CheckEvaluation => {
  if (!replay) {
    return {
      result: 'undecided',
      because: 'replay-gone',
      entries: 0,
      compared: 0,
      regressions: [],
      candidate: null,
      baseline: baseline && totalsOf(baseline),
      gain: null,
    };
  }

  const compared = taskComparisons(replay, baseline);
  const regressions = compared.filter((each) => each.regressed);
  const scored = compared.filter(isScored).length;
  const entries = compared.length;
  const evaluation = {
    entries,
    compared: scored,
    regressions,
    candidate: totalsOf(replay),
    baseline: baseline && totalsOf(baseline),
    gain: baseline && gainBetween(replay, baseline, check.threshold.minGain),
  };

  if (!check.threshold.allows(regressions.length)) {
    return { ...evaluation, result: 'failed', because: null };
  }
  if (
    IN_PROGRESS.includes(replay.current) ||
    (baseline === null && awaitingBaseline && replay.current === 'finished') ||
    (baseline !== null && IN_PROGRESS.includes(baseline.current))
  ) {
    return { ...evaluation, result: 'running', because: null };
  }

  const because = undecidedBecause(replay, baseline, entries, scored);

  return because
    ? { ...evaluation, result: 'undecided', because }
    : { ...evaluation, result: 'passed', because: null };
};
