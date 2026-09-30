import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

export interface ScorePair {
  readonly judge: number;
  readonly human: number;
}

export interface Confusion {
  readonly values: readonly number[];
  readonly cells: readonly (readonly number[])[];
}

export interface Agreement {
  readonly pairs: number;
  readonly observed: number | null;
  readonly kappa: number | null;
  readonly spearman: number | null;
  readonly mae: number | null;
  readonly confusion: Confusion;
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
      const held = order[at];
      if (held) {
        ranks[held.at] = rank;
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

export const agreementOf = (
  scale: ScoreScale,
  pairs: readonly ScorePair[],
): Agreement => ({
  pairs: pairs.length,
  observed: observedAgreement(pairs),
  kappa: scale.categorical ? cohensKappa(scale.values, pairs) : null,
  spearman: scale.categorical ? null : spearman(pairs),
  mae: scale.categorical ? null : meanAbsoluteError(pairs),
  confusion: confusionOf(scale.values, pairs),
});

export const headlineOf = (
  scale: ScoreScale,
  agreement: Agreement,
): number | null => (scale.categorical ? agreement.kappa : agreement.spearman);

const dayOf = (at: Date): string => at.toISOString().slice(0, 10);

export const trendOf = (entries: readonly TrendEntry[]): TrendPoint[] => {
  const days = new Map<string, TrendEntry[]>();

  for (const entry of [...entries].sort(
    (one, other) => one.at.getTime() - other.at.getTime(),
  )) {
    const day = dayOf(entry.at);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }

  return [...days].map(([day, held]) => {
    const labelled = held.flatMap((each) =>
      each.human === null ? [] : [each.human],
    );

    return {
      day,
      judged: held.length,
      judge: meanOf(held.map((each) => each.judge)),
      labelled: labelled.length,
      people: labelled.length > 0 ? meanOf(labelled) : null,
    };
  });
};

export interface Coverage {
  readonly runs: number;
  readonly both: number;
  readonly judgeOnly: number;
  readonly peopleOnly: number;
  readonly neither: number;
}

export const coverageOf = (
  runs: readonly { readonly judged: boolean; readonly labelled: boolean }[],
): Coverage => ({
  runs: runs.length,
  both: runs.filter((each) => each.judged && each.labelled).length,
  judgeOnly: runs.filter((each) => each.judged && !each.labelled).length,
  peopleOnly: runs.filter((each) => !each.judged && each.labelled).length,
  neither: runs.filter((each) => !each.judged && !each.labelled).length,
});
