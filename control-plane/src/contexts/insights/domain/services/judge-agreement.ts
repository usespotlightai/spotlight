import {
  type KappaReading,
  kappaReadingOf,
} from '@insights/domain/services/agreement-reading';
import { rateOf } from '@insights/domain/services/measures';
import { dayOf } from '@insights/domain/value-objects/insights-period.vo';

export interface VerdictPair {
  readonly judge: boolean;
  readonly human: boolean;
}

interface ScorePair {
  readonly judge: number;
  readonly human: number;
}

export interface Confusion {
  readonly values: readonly number[];
  readonly cells: readonly (readonly number[])[];
}

interface ScoreCount {
  readonly value: number;
  readonly judge: number;
  readonly people: number;
}

export interface Agreement {
  readonly pairs: number;
  readonly observed: number | null;
  readonly kappa: number | null;
  readonly f1: number | null;
  readonly reading: KappaReading | null;
  readonly confusion: Confusion;
  readonly distribution: readonly ScoreCount[];
}

export interface TrendEntry {
  readonly at: Date;
  readonly judge: boolean;
  readonly human: boolean | null;
}

export interface TrendPoint {
  readonly day: string;
  readonly judged: number;
  readonly judge: number | null;
  readonly labelled: number;
  readonly people: number | null;
}

const EPSILON = 1e-12;

const meanOf = (values: readonly number[]): number =>
  values.reduce((sum, each) => sum + each, 0) / values.length;

const confusionOf = (
  values: readonly number[],
  pairs: readonly ScorePair[],
): Confusion => {
  const cells = values.map(() => values.map(() => 0));

  for (const pair of pairs) {
    const row = cells[values.indexOf(pair.judge)];
    const column = values.indexOf(pair.human);

    if (row && column >= 0) {
      row[column] = (row[column] ?? 0) + 1;
    }
  }

  return { values, cells };
};

const observedAgreement = (pairs: readonly ScorePair[]): number | null =>
  pairs.length === 0
    ? null
    : pairs.filter((each) => each.judge === each.human).length / pairs.length;

export const cohensKappa = (
  values: readonly number[],
  pairs: readonly ScorePair[],
): number | null => {
  const observed = observedAgreement(pairs);

  if (observed === null) {
    return null;
  }

  const count = pairs.length;
  const chance = values.reduce((sum, value) => {
    const judged = pairs.filter((each) => each.judge === value).length;
    const labelled = pairs.filter((each) => each.human === value).length;
    return sum + (judged / count) * (labelled / count);
  }, 0);

  return 1 - chance < EPSILON ? null : (observed - chance) / (1 - chance);
};

export const f1Of = (
  positive: number,
  pairs: readonly ScorePair[],
): number | null => {
  const both = pairs.filter(
    (each) => each.judge === positive && each.human === positive,
  ).length;
  const positives =
    pairs.filter((each) => each.judge === positive).length +
    pairs.filter((each) => each.human === positive).length;

  return positives === 0 ? null : (2 * both) / positives;
};

export const agreedOf = (confusion: Confusion): number =>
  confusion.cells.reduce((sum, row, at) => sum + (row[at] ?? 0), 0);

export const comparedOf = (confusion: Confusion): number =>
  confusion.cells.flat().reduce((sum, each) => sum + each, 0);

const distributionOf = (confusion: Confusion): ScoreCount[] =>
  confusion.values.map((value, at) => ({
    value,
    judge: (confusion.cells[at] ?? []).reduce((sum, each) => sum + each, 0),
    people: confusion.cells.reduce((sum, row) => sum + (row[at] ?? 0), 0),
  }));

const MET = [0, 1] as const;

const decisionOf = (met: boolean): number => (met ? 1 : 0);

const decisionsOf = (pairs: readonly VerdictPair[]): ScorePair[] =>
  pairs.map((each) => ({
    judge: decisionOf(each.judge),
    human: decisionOf(each.human),
  }));

export const agreementOf = (verdicts: readonly VerdictPair[]): Agreement => {
  const pairs = decisionsOf(verdicts);
  const kappa = cohensKappa(MET, pairs);
  const confusion = confusionOf(MET, pairs);

  return {
    pairs: pairs.length,
    observed: observedAgreement(pairs),
    kappa,
    f1: f1Of(decisionOf(true), pairs),
    reading: kappaReadingOf(kappa),
    confusion,
    distribution: distributionOf(confusion),
  };
};

export const trendOf = (entries: readonly TrendEntry[]): TrendPoint[] => {
  const days = new Map<string, TrendEntry[]>();

  for (const entry of [...entries].sort(
    (one, other) => one.at.getTime() - other.at.getTime(),
  )) {
    const day = dayOf(entry.at);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }

  return [...days].map(([day, onDay]) => {
    const labelled = onDay.flatMap((each) =>
      each.human === null ? [] : [decisionOf(each.human)],
    );

    return {
      day,
      judged: onDay.length,
      judge: meanOf(onDay.map((each) => decisionOf(each.judge))),
      labelled: labelled.length,
      people: labelled.length > 0 ? meanOf(labelled) : null,
    };
  });
};

interface CoverageCounts<T> {
  readonly both: T;
  readonly judgeOnly: T;
  readonly peopleOnly: T;
  readonly neither: T;
}

export interface Coverage extends CoverageCounts<number> {
  readonly runs: number;
  readonly rates: CoverageCounts<number | null>;
}

export const coverageOf = (
  runs: readonly { readonly judged: boolean; readonly labelled: boolean }[],
): Coverage => {
  const counts = {
    both: runs.filter((each) => each.judged && each.labelled).length,
    judgeOnly: runs.filter((each) => each.judged && !each.labelled).length,
    peopleOnly: runs.filter((each) => !each.judged && each.labelled).length,
    neither: runs.filter((each) => !each.judged && !each.labelled).length,
  };

  return {
    runs: runs.length,
    ...counts,
    rates: {
      both: rateOf(counts.both, runs.length),
      judgeOnly: rateOf(counts.judgeOnly, runs.length),
      peopleOnly: rateOf(counts.peopleOnly, runs.length),
      neither: rateOf(counts.neither, runs.length),
    },
  };
};
