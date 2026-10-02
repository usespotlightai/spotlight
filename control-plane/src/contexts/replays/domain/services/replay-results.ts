import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayEnding } from '@replays/domain/value-objects/replay-ending';
import type { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import type { Spend } from '@replays/domain/value-objects/spend.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayTotals {
  readonly entries: number;
  readonly settled: number;
  readonly endings: Readonly<Record<ReplayEnding, number>>;
  readonly succeeded: number | null;
  readonly successRate: number | null;
  readonly scored: number;
  readonly unscored: number;
  readonly spent: Spend;
  readonly spentElsewhere: readonly Spend[];
  readonly unpriced: number;
  readonly unpricedCalls: number;
  readonly steps: number;
  readonly medianSteps: number | null;
  readonly ms: number;
  readonly medianMs: number | null;
}

export interface EntryComparison {
  readonly original: string;
  readonly taskId: string;
  readonly position: number;
  readonly candidate: ReplayEntry;
  readonly baseline: ReplayEntry | null;
  readonly costDelta: number | null;
  readonly msDelta: number | null;
  readonly stepsDelta: number | null;
  readonly scoreDelta: number | null;
  readonly scoreUncompared: ScoreUncompared | null;
  readonly regressed: boolean;
}

export const SCORES_UNCOMPARED = [
  'unjudged',
  'other-rubric',
  'other-reference',
] as const;

type ScoreUncompared = (typeof SCORES_UNCOMPARED)[number];

interface ScoreComparison {
  readonly delta: number | null;
  readonly uncompared: ScoreUncompared | null;
}

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
    : (sorted[middle] as number);
};

const NO_ENDINGS: Record<ReplayEnding, number> = {
  completed: 0,
  failed: 0,
  stopped: 0,
  asked: 0,
  unreplayable: 0,
  'not-run': 0,
};

const within = (
  entries: readonly ReplayEntry[],
  among: readonly RunId[] | null,
): readonly ReplayEntry[] =>
  among
    ? entries.filter((each) => among.some((run) => run.equals(each.original)))
    : entries;

export const totalsOf = (
  replay: Replay,
  among: readonly RunId[] | null = null,
): ReplayTotals => {
  const entries = within(replay.entries, among);
  const spend = among
    ? replay.spendAmong(among)
    : {
        spent: replay.spent,
        spentElsewhere: replay.spentElsewhere,
        unpricedCalls: replay.unpricedCalls,
      };
  const settled = entries.filter((each) => each.isSettled);
  const measured = settled.flatMap((each) =>
    each.measures ? [each.measures] : [],
  );
  const endings = { ...NO_ENDINGS };

  for (const each of settled) {
    const ending = each.ending;

    if (ending) {
      endings[ending] += 1;
    }
  }

  const concluded = settled.filter((each) => each.concludedFor(replay.scoring));
  const judged = concluded.filter((each) => each.succeeded !== null);
  const succeeded = judged.filter((each) => each.succeeded).length;
  const times = measured.flatMap((each) => (each.ms === null ? [] : [each.ms]));

  return {
    entries: entries.length,
    settled: settled.length,
    endings,
    succeeded: judged.length > 0 ? succeeded : null,
    successRate: judged.length > 0 ? succeeded / judged.length : null,
    scored: judged.length,
    unscored: concluded.length - judged.length,
    spent: spend.spent,
    spentElsewhere: spend.spentElsewhere,
    unpriced: measured.filter((each) => !each.cost).length,
    unpricedCalls: spend.unpricedCalls,
    steps: measured.reduce((sum, each) => sum + each.steps, 0),
    medianSteps: median(measured.map((each) => each.steps)),
    ms: times.reduce((sum, each) => sum + each, 0),
    medianMs: median(times),
  };
};

const SCORE_EPSILON = 0.01;

const delta = (
  candidate: number | null | undefined,
  baseline: number | null | undefined,
): number | null =>
  candidate === null ||
  candidate === undefined ||
  baseline === null ||
  baseline === undefined
    ? null
    : candidate - baseline;

const costOf = (entry: ReplayEntry | null, currency: string): number | null => {
  const cost = entry?.measures?.cost;

  return cost && cost.currency === currency ? cost.amount : null;
};

const scoresOf = (
  candidate: { entry: ReplayEntry; rubric: string | null },
  baseline: { entry: ReplayEntry | null; rubric: string | null },
): ScoreComparison => {
  const ours = candidate.entry.verdict;
  const theirs = baseline.entry?.verdict ?? null;

  if (!ours || !theirs) {
    return { delta: null, uncompared: 'unjudged' };
  }
  if (candidate.rubric !== baseline.rubric) {
    return { delta: null, uncompared: 'other-rubric' };
  }
  if (ours.referenced !== theirs.referenced) {
    return { delta: null, uncompared: 'other-reference' };
  }

  return { delta: ours.scoredAgainst(theirs), uncompared: null };
};

const regressedFrom = (
  candidate: ReplayEntry,
  baseline: ReplayEntry | null,
  scoreDelta: number | null,
): boolean =>
  baseline !== null &&
  ((baseline.succeeded === true && candidate.succeeded === false) ||
    (scoreDelta !== null && scoreDelta < -SCORE_EPSILON));

export const comparedWith = (
  candidate: Replay,
  baseline: Replay | null,
  among: readonly RunId[] | null = null,
): readonly EntryComparison[] => {
  const currency = candidate.ceiling.currency;

  return within(candidate.entries, among)
    .map((entry) => {
      const against =
        baseline?.entries.find((each) =>
          each.original.equals(entry.original),
        ) ?? null;
      const settled = entry.isSettled && (against?.isSettled ?? false);
      const scores = scoresOf(
        { entry, rubric: candidate.rubricVersion },
        { entry: against, rubric: baseline?.rubricVersion ?? null },
      );

      return {
        original: entry.original.value,
        taskId: entry.taskId.value,
        position: entry.position,
        candidate: entry,
        baseline: against,
        costDelta: settled
          ? delta(costOf(entry, currency), costOf(against, currency))
          : null,
        msDelta: settled
          ? delta(entry.measures?.ms, against?.measures?.ms)
          : null,
        stepsDelta: settled
          ? delta(entry.measures?.steps, against?.measures?.steps)
          : null,
        scoreDelta: scores.delta,
        scoreUncompared: scores.uncompared,
        regressed: regressedFrom(entry, against, scores.delta),
      };
    })
    .sort(
      (one, other) =>
        Number(other.regressed) - Number(one.regressed) ||
        one.position - other.position,
    );
};
