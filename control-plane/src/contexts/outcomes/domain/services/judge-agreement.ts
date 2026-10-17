import {
  type CorrelationReading,
  correlationReadingOf,
  type KappaReading,
  kappaReadingOf,
} from '@outcomes/domain/services/agreement-reading';
import { rateOf } from '@outcomes/domain/services/measures';
import { dayOf } from '@outcomes/domain/value-objects/insights-period.vo';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

export interface ScorePair {
  readonly judge: number;
  readonly human: number;
}

export interface Confusion {
  readonly values: readonly number[];
  readonly cells: readonly (readonly number[])[];
}

export interface ScoreCount {
  readonly value: number;
  readonly judge: number;
  readonly people: number;
}

interface ClaimAgreement {
  readonly index: number;
  readonly pairs: number;
  readonly observed: number | null;
  readonly kappa: number | null;
  readonly reading: KappaReading | null;
}

export interface AgreementReadings {
  readonly kappa: KappaReading | null;
  readonly pearson: CorrelationReading | null;
  readonly spearman: CorrelationReading | null;
}

export interface Agreement {
  readonly pairs: number;
  readonly observed: number | null;
  readonly kappa: number | null;
  readonly spearman: number | null;
  readonly pearson: number | null;
  readonly mae: number | null;
  readonly rmse: number | null;
  readonly f1: number | null;
  readonly readings: AgreementReadings;
  readonly confusion: Confusion;
  readonly distribution: readonly ScoreCount[];
  readonly claims: readonly ClaimAgreement[];
}

export interface ClaimsPair {
  readonly judge: readonly boolean[];
  readonly human: readonly boolean[];
}

export interface TrendEntry {
  readonly at: Date;
  readonly judge: number;
  readonly human: number | null;
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

export const confusionOf = (
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

const ranksOf = (values: readonly number[]): number[] => {
  const order = values
    .map((value, at) => ({ value, at }))
    .sort((one, other) => one.value - other.value);
  const ranks = new Array<number>(values.length).fill(0);
  let from = 0;

  while (from < order.length) {
    let to = from;

    while (
      to + 1 < order.length &&
      order[to + 1]?.value === order[from]?.value
    ) {
      to += 1;
    }

    const rank = (from + to) / 2 + 1;

    for (let at = from; at <= to; at += 1) {
      const item = order[at];
      if (item) {
        ranks[item.at] = rank;
      }
    }

    from = to + 1;
  }

  return ranks;
};

const pearson = (
  xs: readonly number[],
  ys: readonly number[],
): number | null => {
  const meanX = meanOf(xs);
  const meanY = meanOf(ys);
  let shared = 0;
  let spreadX = 0;
  let spreadY = 0;

  xs.forEach((x, at) => {
    const dx = x - meanX;
    const dy = (ys[at] ?? meanY) - meanY;
    shared += dx * dy;
    spreadX += dx * dx;
    spreadY += dy * dy;
  });

  return spreadX < EPSILON || spreadY < EPSILON
    ? null
    : shared / Math.sqrt(spreadX * spreadY);
};

export const pearsonOf = (pairs: readonly ScorePair[]): number | null =>
  pairs.length < 2
    ? null
    : pearson(
        pairs.map((each) => each.judge),
        pairs.map((each) => each.human),
      );

export const spearman = (pairs: readonly ScorePair[]): number | null =>
  pairs.length < 2
    ? null
    : pearson(
        ranksOf(pairs.map((each) => each.judge)),
        ranksOf(pairs.map((each) => each.human)),
      );

export const meanAbsoluteError = (
  pairs: readonly ScorePair[],
): number | null =>
  pairs.length === 0
    ? null
    : meanOf(pairs.map((each) => Math.abs(each.judge - each.human)));

export const rootMeanSquareError = (
  pairs: readonly ScorePair[],
): number | null =>
  pairs.length === 0
    ? null
    : Math.sqrt(meanOf(pairs.map((each) => (each.judge - each.human) ** 2)));

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

export const distributionOf = (confusion: Confusion): ScoreCount[] =>
  confusion.values.map((value, at) => ({
    value,
    judge: (confusion.cells[at] ?? []).reduce((sum, each) => sum + each, 0),
    people: confusion.cells.reduce((sum, row) => sum + (row[at] ?? 0), 0),
  }));

const readingsOf = (
  figures: Pick<Agreement, 'kappa' | 'pearson' | 'spearman'>,
): AgreementReadings => ({
  kappa: kappaReadingOf(figures.kappa),
  pearson: correlationReadingOf(figures.pearson),
  spearman: correlationReadingOf(figures.spearman),
});

export const agreementOf = (
  scale: ScoreScale,
  pairs: readonly ScorePair[],
): Agreement => {
  const figures = {
    kappa: scale.categorical ? cohensKappa(scale.values, pairs) : null,
    pearson: scale.categorical ? null : pearsonOf(pairs),
    spearman: scale.categorical ? null : spearman(pairs),
  };
  const confusion = confusionOf(scale.values, pairs);

  return {
    pairs: pairs.length,
    observed: observedAgreement(pairs),
    ...figures,
    mae: scale.categorical ? null : meanAbsoluteError(pairs),
    rmse: scale.categorical ? null : rootMeanSquareError(pairs),
    f1: scale.categorical ? f1Of(scale.yes, pairs) : null,
    readings: readingsOf(figures),
    confusion,
    distribution: distributionOf(confusion),
    claims: [],
  };
};

const MET = [0, 1] as const;

const decisionOf = (met: boolean): number => (met ? 1 : 0);

export const claimsAgreementOf = (pairs: readonly ClaimsPair[]): Agreement => {
  const compared = pairs.filter(
    (each) => each.judge.length > 0 && each.judge.length === each.human.length,
  );
  const count = Math.max(0, ...compared.map((each) => each.judge.length));
  const decisionsAt = (index: number): ScorePair[] =>
    compared.flatMap((each) => {
      const judge = each.judge[index];
      const human = each.human[index];

      return judge === undefined || human === undefined
        ? []
        : [{ judge: decisionOf(judge), human: decisionOf(human) }];
    });
  const pooled = Array.from({ length: count }, (_, at) =>
    decisionsAt(at),
  ).flat();
  const figures = {
    kappa: cohensKappa(MET, pooled),
    pearson: null,
    spearman: null,
  };
  const confusion = confusionOf(MET, pooled);

  return {
    pairs: compared.length,
    observed: observedAgreement(pooled),
    ...figures,
    mae: null,
    rmse: null,
    f1: f1Of(decisionOf(true), pooled),
    readings: readingsOf(figures),
    confusion,
    distribution: distributionOf(confusion),
    claims: Array.from({ length: count }, (_, index) => {
      const decisions = decisionsAt(index);
      const kappa = cohensKappa(MET, decisions);

      return {
        index,
        pairs: decisions.length,
        observed: observedAgreement(decisions),
        kappa,
        reading: kappaReadingOf(kappa),
      };
    }),
  };
};

export const headlineOf = (
  scale: ScoreScale,
  agreement: Agreement,
): number | null =>
  scale.categorical || scale.byClaims ? agreement.kappa : agreement.spearman;

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
      each.human === null ? [] : [each.human],
    );

    return {
      day,
      judged: onDay.length,
      judge: meanOf(onDay.map((each) => each.judge)),
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
  readonly shares: CoverageCounts<number | null>;
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
    shares: {
      both: rateOf(counts.both, runs.length),
      judgeOnly: rateOf(counts.judgeOnly, runs.length),
      peopleOnly: rateOf(counts.peopleOnly, runs.length),
      neither: rateOf(counts.neither, runs.length),
    },
  };
};
