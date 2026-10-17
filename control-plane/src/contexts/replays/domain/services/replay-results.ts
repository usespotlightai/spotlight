import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  type RateInterval,
  rateIntervalOf,
} from '@replays/domain/services/bootstrap';
import type { Scoring } from '@replays/domain/services/entry-result';
import type { PairOutcome } from '@replays/domain/value-objects/entry-pairing.vo';
import type { ReplayEnding } from '@replays/domain/value-objects/replay-ending';
import type { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import type { Spend } from '@replays/domain/value-objects/spend.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayTotals {
  readonly entries: number;
  readonly ended: number;
  readonly endings: Readonly<Record<ReplayEnding, number>>;
  readonly succeeded: number | null;
  readonly successRate: number | null;
  readonly interval: RateInterval | null;
  readonly scored: number;
  readonly tasks: number;
  readonly tasksScored: number;
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
  readonly candidate: readonly ReplayEntry[];
  readonly baseline: readonly ReplayEntry[];
  readonly candidateSuccess: number | null;
  readonly baselineSuccess: number | null;
  readonly costDelta: number | null;
  readonly msDelta: number | null;
  readonly stepsDelta: number | null;
  readonly scoreDelta: number | null;
  readonly scoreUncompared: ScoreUncompared | null;
  readonly regressed: boolean;
  readonly pair: PairOutcome | null;
}

export interface PairTally {
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
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

const mean = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((sum, each) => sum + each, 0) / values.length;

const NO_ENDINGS: Record<ReplayEnding, number> = {
  completed: 0,
  failed: 0,
  stopped: 0,
  asked: 0,
  unreplayable: 0,
  'not-run': 0,
};

const REGRESSED_BY = 0.5;

const SCORE_EPSILON = 0.01;

const within = (
  entries: readonly ReplayEntry[],
  among: readonly RunId[] | null,
): readonly ReplayEntry[] =>
  among
    ? entries.filter((each) => among.some((run) => run.equals(each.original)))
    : entries;

const judgedIn = (
  entries: readonly ReplayEntry[],
  scoring: Scoring,
): readonly ReplayEntry[] =>
  entries.filter(
    (each) =>
      each.hasEnded && each.concludedFor(scoring) && each.succeeded !== null,
  );

export const copiesByOriginal = (
  entries: readonly ReplayEntry[],
): ReadonlyMap<string, readonly ReplayEntry[]> => {
  const copies = new Map<string, ReplayEntry[]>();

  for (const each of [...entries].sort(
    (one, other) => one.position - other.position,
  )) {
    copies.set(each.original.value, [
      ...(copies.get(each.original.value) ?? []),
      each,
    ]);
  }

  return copies;
};

const successOf = (
  copies: readonly ReplayEntry[],
  scoring: Scoring,
): number | null => {
  const judged = judgedIn(copies, scoring);

  return mean(judged.map((each) => (each.succeeded ? 1 : 0)));
};

export const taskSuccessesOf = (
  replay: Replay,
  among: readonly RunId[] | null = null,
): ReadonlyMap<string, number> => {
  const successes = new Map<string, number>();

  for (const [original, copies] of copiesByOriginal(
    within(replay.entries, among),
  )) {
    const success = successOf(copies, replay.scoring);

    if (success !== null) {
      successes.set(original, success);
    }
  }

  return successes;
};

export const scoredOriginalsOf = (replay: Replay): readonly RunId[] => {
  const successes = taskSuccessesOf(replay);

  return replay.originals.filter((original) => successes.has(original.value));
};

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
  const ended = entries.filter((each) => each.hasEnded);
  const measured = ended.flatMap((each) =>
    each.measures ? [each.measures] : [],
  );
  const endings = { ...NO_ENDINGS };

  for (const each of ended) {
    const ending = each.ending;

    if (ending) {
      endings[ending] += 1;
    }
  }

  const concluded = ended.filter((each) => each.concludedFor(replay.scoring));
  const judged = judgedIn(entries, replay.scoring);
  const succeeded = judged.filter((each) => each.succeeded).length;
  const perTask = [...taskSuccessesOf(replay, among).values()];
  const interval = rateIntervalOf(perTask, replay.id.value);
  const times = measured.flatMap((each) => (each.ms === null ? [] : [each.ms]));

  return {
    entries: entries.length,
    ended: ended.length,
    endings,
    succeeded: judged.length > 0 ? succeeded : null,
    successRate: interval?.rate ?? null,
    interval,
    scored: judged.length,
    tasks: copiesByOriginal(entries).size,
    tasksScored: perTask.length,
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

const delta = (
  candidate: number | null,
  baseline: number | null,
): number | null =>
  candidate === null || baseline === null ? null : candidate - baseline;

const meanOver = (
  copies: readonly ReplayEntry[],
  measureOf: (entry: ReplayEntry) => number | null | undefined,
): number | null =>
  mean(
    copies.flatMap((each) => {
      const value = measureOf(each);

      return value === null || value === undefined ? [] : [value];
    }),
  );

const costIn =
  (currency: string) =>
  (entry: ReplayEntry): number | null => {
    const cost = entry.measures?.cost;

    return cost && cost.currency === currency ? cost.amount : null;
  };

const verdictsOf = (copies: readonly ReplayEntry[]) =>
  copies.flatMap((each) => (each.verdict ? [each.verdict] : []));

const scoresOf = (
  candidate: { copies: readonly ReplayEntry[]; rubric: string | null },
  baseline: { copies: readonly ReplayEntry[]; rubric: string | null },
): ScoreComparison => {
  const ours = verdictsOf(candidate.copies);
  const theirs = verdictsOf(baseline.copies);
  const every = [...ours, ...theirs];
  const [first] = every;

  if (ours.length === 0 || theirs.length === 0 || !first) {
    return { delta: null, uncompared: 'unjudged' };
  }
  if (candidate.rubric !== baseline.rubric) {
    return { delta: null, uncompared: 'other-rubric' };
  }
  if (every.some((each) => each.referenced !== first.referenced)) {
    return { delta: null, uncompared: 'other-reference' };
  }
  if (every.some((each) => each.scale !== first.scale)) {
    return { delta: null, uncompared: null };
  }

  return {
    delta: delta(
      mean(ours.map((each) => each.value)),
      mean(theirs.map((each) => each.value)),
    ),
    uncompared: null,
  };
};

const regressedFrom = (
  candidateSuccess: number | null,
  baselineSuccess: number | null,
  scoreDelta: number | null,
): boolean =>
  (candidateSuccess !== null &&
    baselineSuccess !== null &&
    baselineSuccess - candidateSuccess > REGRESSED_BY) ||
  (scoreDelta !== null && scoreDelta < -SCORE_EPSILON);

export const pairOutcomeOf = (
  copies: readonly ReplayEntry[],
): PairOutcome | null => {
  const outcomes = copies.flatMap((each) => {
    const verdict = each.pairing?.verdict;

    return verdict ? [verdict.outcome] : [];
  });
  const wins = outcomes.filter((each) => each === 'win').length;
  const losses = outcomes.filter((each) => each === 'loss').length;

  if (outcomes.length === 0) {
    return null;
  }
  if (wins === losses) {
    return 'tie';
  }

  return wins > losses ? 'win' : 'loss';
};

export const pairTallyOf = (
  replay: Replay,
  among: readonly RunId[] | null = null,
): PairTally | null => {
  if (!replay.pairsWith) {
    return null;
  }

  const outcomes = [...copiesByOriginal(within(replay.entries, among)).values()]
    .map(pairOutcomeOf)
    .filter((each) => each !== null);

  return {
    wins: outcomes.filter((each) => each === 'win').length,
    losses: outcomes.filter((each) => each === 'loss').length,
    ties: outcomes.filter((each) => each === 'tie').length,
  };
};

export const comparedWith = (
  candidate: Replay,
  baseline: Replay | null,
  among: readonly RunId[] | null = null,
): readonly EntryComparison[] => {
  const cost = costIn(candidate.ceiling.currency);
  const against = copiesByOriginal(baseline?.entries ?? []);

  return [...copiesByOriginal(within(candidate.entries, among))]
    .map(([original, copies]) => {
      const theirs = against.get(original) ?? [];
      const bothEnded =
        copies.every((each) => each.hasEnded) &&
        theirs.length > 0 &&
        theirs.every((each) => each.hasEnded);
      const measured = (
        measureOf: (entry: ReplayEntry) => number | null | undefined,
      ): number | null =>
        bothEnded
          ? delta(meanOver(copies, measureOf), meanOver(theirs, measureOf))
          : null;
      const scores = scoresOf(
        { copies, rubric: candidate.rubricVersion },
        { copies: theirs, rubric: baseline?.rubricVersion ?? null },
      );
      const concluded =
        bothEnded &&
        copies.every((each) => each.concludedFor(candidate.scoring)) &&
        baseline !== null &&
        theirs.every((each) => each.concludedFor(baseline.scoring));
      const candidateSuccess = successOf(copies, candidate.scoring);
      const baselineSuccess = baseline
        ? successOf(theirs, baseline.scoring)
        : null;
      const [first] = copies as [ReplayEntry];

      return {
        original,
        taskId: first.taskId.value,
        position: first.position,
        candidate: copies,
        baseline: theirs,
        candidateSuccess,
        baselineSuccess,
        costDelta: measured(cost),
        msDelta: measured((each) => each.measures?.ms),
        stepsDelta: measured((each) => each.measures?.steps),
        scoreDelta: scores.delta,
        scoreUncompared: scores.uncompared,
        regressed:
          concluded &&
          regressedFrom(candidateSuccess, baselineSuccess, scores.delta),
        pair: pairOutcomeOf(copies),
      };
    })
    .sort(
      (one, other) =>
        Number(other.regressed) - Number(one.regressed) ||
        one.position - other.position,
    );
};
