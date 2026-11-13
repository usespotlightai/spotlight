import {
  type RateInterval,
  rateIntervalOf,
} from '@replays/domain/services/bootstrap';
import type { PairOutcome } from '@replays/domain/value-objects/entry-pairing.vo';
import type { Money } from '@replays/domain/value-objects/money.vo';
import type { ReplayEnding } from '@replays/domain/value-objects/replay-ending';
import type {
  EntryOutcome,
  OutcomeVerdict,
  ReplayOutcome,
} from '@replays/domain/value-objects/replay-outcome.vo';
import { JudgeScale } from '@shared-kernel/domain/value-objects/judge-scale.vo';
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
  readonly spent: Money;
  readonly spentElsewhere: readonly Money[];
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
  readonly candidate: readonly EntryOutcome[];
  readonly baseline: readonly EntryOutcome[];
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

const SCORES_UNCOMPARED = [
  'unjudged',
  'other-rubric',
  'other-reference',
] as const;

type ScoreUncompared = (typeof SCORES_UNCOMPARED)[number];

interface ScoreComparison {
  readonly delta: number | null;
  readonly uncompared: ScoreUncompared | null;
  readonly worse: boolean;
}

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
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

const REGRESSED_AT = 0.9;

const ROUNDING = 1e-6;

const GRID = 2048;

const within = (
  entries: readonly EntryOutcome[],
  runSubset: readonly RunId[] | null,
): readonly EntryOutcome[] =>
  runSubset
    ? entries.filter((each) =>
        runSubset.some((run) => run.equals(each.original)),
      )
    : entries;

const judgedIn = (entries: readonly EntryOutcome[]): readonly EntryOutcome[] =>
  entries.filter(
    (each) => each.hasEnded && each.concluded && each.succeeded !== null,
  );

export const repeatsByOriginal = (
  entries: readonly EntryOutcome[],
): ReadonlyMap<string, readonly EntryOutcome[]> => {
  const repeats = new Map<string, EntryOutcome[]>();

  for (const each of [...entries].sort(
    (one, other) => one.position - other.position,
  )) {
    repeats.set(each.original.value, [
      ...(repeats.get(each.original.value) ?? []),
      each,
    ]);
  }

  return repeats;
};

const successOf = (repeats: readonly EntryOutcome[]): number | null => {
  const judged = judgedIn(repeats);

  return mean(judged.map((each) => (each.succeeded ? 1 : 0)));
};

interface Tally {
  readonly succeeded: number;
  readonly judged: number;
}

const tallyOf = (repeats: readonly EntryOutcome[]): Tally => {
  const judged = judgedIn(repeats);

  return {
    succeeded: judged.filter((each) => each.succeeded).length,
    judged: judged.length,
  };
};

const scoreTallyOf = (verdicts: readonly OutcomeVerdict[]): Tally => ({
  succeeded: verdicts.reduce(
    (sum, each) => sum + JudgeScale.of(each.scale).shareOf(each.value),
    0,
  ),
  judged: verdicts.length,
});

const likelihoodOf = (tally: Tally): readonly number[] =>
  Array.from({ length: GRID }, (_, at) => {
    const rate = (at + 0.5) / GRID;

    return (
      rate ** tally.succeeded * (1 - rate) ** (tally.judged - tally.succeeded)
    );
  });

export const chanceWorse = (candidate: Tally, baseline: Tally): number => {
  const ours = likelihoodOf(candidate);
  const theirs = likelihoodOf(baseline);
  let oursBelow = 0;
  let oursTotal = 0;
  let theirsTotal = 0;
  let worse = 0;

  for (let at = 0; at < GRID; at += 1) {
    worse += theirs[at] * (oursBelow + ours[at] / 2);
    oursBelow += ours[at];
    oursTotal += ours[at];
    theirsTotal += theirs[at];
  }

  return worse / (oursTotal * theirsTotal);
};

const clearlyWorse = (candidate: Tally, baseline: Tally): boolean =>
  candidate.judged > 0 &&
  baseline.judged > 0 &&
  chanceWorse(candidate, baseline) > REGRESSED_AT + ROUNDING;

export const taskSuccessesOf = (
  replay: ReplayOutcome,
  runSubset: readonly RunId[] | null = null,
): ReadonlyMap<string, number> => {
  const successes = new Map<string, number>();

  for (const [original, repeats] of repeatsByOriginal(
    within(replay.entries, runSubset),
  )) {
    const success = successOf(repeats);

    if (success !== null) {
      successes.set(original, success);
    }
  }

  return successes;
};

export const totalsOf = (
  replay: ReplayOutcome,
  runSubset: readonly RunId[] | null = null,
): ReplayTotals => {
  const entries = within(replay.entries, runSubset);
  const spend = runSubset ? replay.spendAmong(runSubset) : replay.spend;
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

  const concluded = ended.filter((each) => each.concluded);
  const judged = judgedIn(entries);
  const succeeded = judged.filter((each) => each.succeeded).length;
  const perTask = [...taskSuccessesOf(replay, runSubset).values()];
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
    tasks: repeatsByOriginal(entries).size,
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
  repeats: readonly EntryOutcome[],
  measureOf: (entry: EntryOutcome) => number | null | undefined,
): number | null =>
  mean(
    repeats.flatMap((each) => {
      const value = measureOf(each);

      return value === null || value === undefined ? [] : [value];
    }),
  );

const costIn =
  (currency: string) =>
  (entry: EntryOutcome): number | null => {
    const cost = entry.measures?.cost;

    return cost && cost.currency === currency ? cost.amount : null;
  };

const verdictsOf = (repeats: readonly EntryOutcome[]) =>
  repeats.flatMap((each) => (each.verdict ? [each.verdict] : []));

const scoresOf = (
  candidate: { repeats: readonly EntryOutcome[]; rubric: string | null },
  baseline: { repeats: readonly EntryOutcome[]; rubric: string | null },
): ScoreComparison => {
  const ours = verdictsOf(candidate.repeats);
  const theirs = verdictsOf(baseline.repeats);
  const every = [...ours, ...theirs];
  const [first] = every;

  if (ours.length === 0 || theirs.length === 0 || !first) {
    return { delta: null, uncompared: 'unjudged', worse: false };
  }
  if (candidate.rubric !== baseline.rubric) {
    return { delta: null, uncompared: 'other-rubric', worse: false };
  }
  if (every.some((each) => each.referenced !== first.referenced)) {
    return { delta: null, uncompared: 'other-reference', worse: false };
  }
  if (every.some((each) => each.scale !== first.scale)) {
    return { delta: null, uncompared: null, worse: false };
  }

  return {
    delta: delta(
      mean(ours.map((each) => each.value)),
      mean(theirs.map((each) => each.value)),
    ),
    uncompared: null,
    worse: clearlyWorse(scoreTallyOf(ours), scoreTallyOf(theirs)),
  };
};

export const pairOutcomeOf = (
  repeats: readonly EntryOutcome[],
): PairOutcome | null => {
  const outcomes = repeats.flatMap((each) => {
    return each.pair ? [each.pair] : [];
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
  replay: ReplayOutcome,
  runSubset: readonly RunId[] | null = null,
): PairTally | null => {
  if (!replay.pairwiseReferenceId) {
    return null;
  }

  const outcomes = [
    ...repeatsByOriginal(within(replay.entries, runSubset)).values(),
  ]
    .map(pairOutcomeOf)
    .filter((each) => each !== null);

  return {
    wins: outcomes.filter((each) => each === 'win').length,
    losses: outcomes.filter((each) => each === 'loss').length,
    ties: outcomes.filter((each) => each === 'tie').length,
  };
};

export const taskComparisons = (
  candidate: ReplayOutcome,
  baseline: ReplayOutcome | null,
  runSubset: readonly RunId[] | null = null,
): readonly EntryComparison[] => {
  const cost = costIn(candidate.currency);
  const against = repeatsByOriginal(baseline?.entries ?? []);

  return [...repeatsByOriginal(within(candidate.entries, runSubset))]
    .map(([original, repeats]) => {
      const theirs = against.get(original) ?? [];
      const bothEnded =
        repeats.every((each) => each.hasEnded) &&
        theirs.length > 0 &&
        theirs.every((each) => each.hasEnded);
      const measured = (
        measureOf: (entry: EntryOutcome) => number | null | undefined,
      ): number | null =>
        bothEnded
          ? delta(meanOver(repeats, measureOf), meanOver(theirs, measureOf))
          : null;
      const scores = scoresOf(
        { repeats, rubric: candidate.rubricVersion },
        { repeats: theirs, rubric: baseline?.rubricVersion ?? null },
      );
      const concluded =
        bothEnded &&
        repeats.every((each) => each.concluded) &&
        baseline !== null &&
        theirs.every((each) => each.concluded);
      const candidateSuccess = successOf(repeats);
      const baselineSuccess = baseline ? successOf(theirs) : null;
      const [first] = repeats as [EntryOutcome];

      return {
        original,
        taskId: first.taskId.value,
        position: first.position,
        candidate: repeats,
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
          (clearlyWorse(tallyOf(repeats), tallyOf(theirs)) || scores.worse),
        pair: pairOutcomeOf(repeats),
      };
    })
    .sort(
      (one, other) =>
        Number(other.regressed) - Number(one.regressed) ||
        one.position - other.position,
    );
};
