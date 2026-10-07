interface RatedRuns<Interval> {
  readonly successRate: number | null;
  readonly interval: Interval | null;
  readonly costPerRun: number | null;
}

interface LiveRuns<Interval> extends RatedRuns<Interval> {
  readonly currency: string;
}

export interface CandidateRuns<Interval> {
  readonly overall: RatedRuns<Interval>;
  readonly scored: number;
  readonly onCompared: RatedRuns<Interval>;
  readonly compared: number;
  readonly currency: string;
  readonly live: LiveRuns<Interval> | null;
}

type Basis = 'compared' | 'overall';

export interface ShownAgainstLive<Interval> {
  readonly basis: Basis;
  readonly costBasis: Basis;
  readonly successRate: number | null;
  readonly interval: Interval | null;
  readonly liveSuccessRate: number | null;
  readonly runs: number;
  readonly costPerRun: number | null;
  readonly liveCostPerRun: number | null;
}

export const shownAgainstLive = <Interval>(
  candidate: CandidateRuns<Interval>,
): ShownAgainstLive<Interval> => {
  const { live, overall, onCompared } = candidate;

  if (!live || candidate.compared === 0) {
    return {
      basis: 'overall',
      costBasis: 'overall',
      successRate: overall.successRate,
      interval: overall.interval,
      liveSuccessRate: null,
      runs: candidate.scored,
      costPerRun: overall.costPerRun,
      liveCostPerRun: null,
    };
  }

  const sameCurrency = live.currency === candidate.currency;

  return {
    basis: 'compared',
    costBasis: sameCurrency ? 'compared' : 'overall',
    successRate: onCompared.successRate,
    interval: onCompared.interval,
    liveSuccessRate: live.successRate,
    runs: candidate.compared,
    costPerRun: sameCurrency ? onCompared.costPerRun : overall.costPerRun,
    liveCostPerRun: sameCurrency ? live.costPerRun : null,
  };
};

export const rankedByGain = <Item>(
  items: readonly Item[],
  gainOf: (item: Item) => number | null,
): Item[] => {
  const byGain = (one: Item, other: Item): number => {
    const ours = gainOf(one);
    const theirs = gainOf(other);

    if (ours === theirs) {
      return 0;
    }
    if (ours === null) {
      return 1;
    }

    return theirs === null ? -1 : theirs - ours;
  };

  return [...items].sort(byGain);
};
