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
import type { JudgeCalibration } from '@replays/domain/value-objects/judge-calibration';
import type { ReplayOutcome } from '@replays/domain/value-objects/replay-outcome.vo';

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

export const FAILED_BECAUSE = [
  'too-many-regressions',
  'judge-disagrees-with-people',
] as const;

export type FailedBecause = (typeof FAILED_BECAUSE)[number];

export interface CheckEvaluation {
  readonly result: CheckResult;
  readonly because: UndecidedBecause | null;
  readonly failedBecause: FailedBecause | null;
  readonly judge: JudgeCalibration | null;
  readonly entries: number;
  readonly compared: number;
  readonly tasks: readonly EntryComparison[];
  readonly candidate: ReplayTotals | null;
  readonly baseline: ReplayTotals | null;
  readonly gain: GainEstimate | null;
}

const IN_PROGRESS: readonly string[] = ['queued', 'running'];

const isScored = (each: EntryComparison): boolean =>
  each.candidateSuccess !== null && each.baselineSuccess !== null;

const undecidedBecause = (
  replay: ReplayOutcome,
  baseline: ReplayOutcome | null,
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
  replay: ReplayOutcome | null,
  baseline: ReplayOutcome | null,
  awaitingBaseline: boolean,
): CheckEvaluation => {
  const { judge } = check;
  const judgeFails = judge?.fails() ?? false;
  const failedByJudge = {
    result: 'failed',
    because: null,
    failedBecause: 'judge-disagrees-with-people',
  } as const;

  if (!replay) {
    return {
      ...(judgeFails
        ? failedByJudge
        : awaitingBaseline
          ? { result: 'running', because: null, failedBecause: null }
          : {
              result: 'undecided',
              because: 'replay-gone',
              failedBecause: null,
            }),
      judge,
      entries: 0,
      compared: 0,
      tasks: [],
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
    judge,
    entries,
    compared: scored,
    tasks: compared,
    candidate: totalsOf(replay),
    baseline: baseline && totalsOf(baseline),
    gain: baseline && gainBetween(replay, baseline, check.threshold.minGain),
  };

  if (judgeFails) {
    return { ...evaluation, ...failedByJudge };
  }
  if (!check.threshold.allows(regressions.length)) {
    return {
      ...evaluation,
      result: 'failed',
      because: null,
      failedBecause: 'too-many-regressions',
    };
  }
  if (
    IN_PROGRESS.includes(replay.current) ||
    (baseline === null && awaitingBaseline && replay.current === 'finished') ||
    (baseline !== null && IN_PROGRESS.includes(baseline.current))
  ) {
    return {
      ...evaluation,
      result: 'running',
      because: null,
      failedBecause: null,
    };
  }

  const because = undecidedBecause(replay, baseline, entries, scored);

  return because
    ? { ...evaluation, result: 'undecided', because, failedBecause: null }
    : { ...evaluation, result: 'passed', because: null, failedBecause: null };
};
