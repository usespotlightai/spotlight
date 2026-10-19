import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { RateInterval } from '@replays/domain/services/bootstrap';
import {
  type GainEstimate,
  type GainSignificance,
  gainBetween,
} from '@replays/domain/services/gain-estimate';
import {
  type PairTally,
  pairTallyOf,
  totalsOf,
} from '@replays/domain/services/replay-results';
import {
  countRegressions,
  NO_REGRESSIONS,
  regressionsOf,
  type SearchRegressions,
} from '@replays/domain/services/search-regressions';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface CandidateScores {
  readonly candidateId: CandidateId;
  readonly searchedGain: GainEstimate | null;
  readonly heldOutGain: GainEstimate | null;
  readonly searchedPairs: PairTally | null;
  readonly heldOutPairs: PairTally | null;
  readonly searchedSignificance: GainSignificance | null;
  readonly heldOutSignificance: GainSignificance | null;
  readonly regressions: SearchRegressions;
  readonly replayId: ReplayId;
  readonly heldOutReplayId: ReplayId | null;
  readonly seed: boolean;
  readonly finished: boolean;
  readonly searchScore: number | null;
  readonly searchInterval: RateInterval | null;
  readonly searchScored: number;
  readonly heldOutScore: number | null;
  readonly heldOutInterval: RateInterval | null;
  readonly costPerRun: number | null;
  readonly spent: Money;
}

export interface SearchScores {
  readonly seed: CandidateScores;
  readonly candidates: readonly CandidateScores[];
}

interface Scored {
  readonly score: number | null;
  readonly interval: RateInterval | null;
  readonly scored: number;
  readonly costPerRun: number | null;
  readonly spent: Money;
}

export const scoredOn = (
  replay: Replay | null,
  runSubset: readonly RunId[] | null,
  currency: string,
): Scored => {
  if (!replay) {
    return {
      score: null,
      interval: null,
      scored: 0,
      costPerRun: null,
      spent: Money.none(currency),
    };
  }

  const totals = totalsOf(replay, runSubset);
  const priced =
    totals.unpriced === 0 &&
    totals.unpricedCalls === 0 &&
    totals.spentElsewhere.length === 0;

  return {
    score: totals.successRate,
    interval: totals.interval,
    scored: totals.scored,
    costPerRun:
      priced && totals.scored > 0 ? totals.spent.amount / totals.scored : null,
    spent: totals.spent,
  };
};

const finished = (replay: Replay | null): boolean =>
  replay?.current === 'finished';

const pairsOf = (
  replay: Replay | null,
  runSubset: readonly RunId[],
): PairTally | null => (replay ? pairTallyOf(replay, runSubset) : null);

export const scoresOf = (
  search: Search,
  replays: readonly Replay[],
  minGain: number,
): SearchScores => {
  const currency = search.budget.ceiling.currency;
  const gains = searchGainsOf(search, replays, minGain);
  const found = (id: ReplayId): Replay | null =>
    replays.find((each) => each.id.equals(id)) ?? null;
  const seedReplay = found(search.seed.replay.replayId);
  const seedSearched = scoredOn(
    seedReplay,
    search.split.searchedRuns,
    currency,
  );
  const seedHeldOut = scoredOn(seedReplay, search.split.heldOutRuns, currency);

  return {
    seed: {
      candidateId: search.seed.candidateId,
      searchedGain: null,
      heldOutGain: null,
      searchedPairs: null,
      heldOutPairs: null,
      searchedSignificance: null,
      heldOutSignificance: null,
      regressions: NO_REGRESSIONS,
      replayId: search.seed.replay.replayId,
      heldOutReplayId: null,
      seed: true,
      finished: finished(seedReplay),
      searchScore: seedSearched.score,
      searchInterval: seedSearched.interval,
      searchScored: seedSearched.scored,
      heldOutScore: finished(seedReplay) ? seedHeldOut.score : null,
      heldOutInterval: finished(seedReplay) ? seedHeldOut.interval : null,
      costPerRun: seedSearched.costPerRun,
      spent: seedReplay?.spent ?? Money.none(currency),
    },
    candidates: search.proposals.map((proposal) => {
      const searchReplay = found(proposal.replay.replayId);
      const heldOutId =
        search.heldOut.find((each) =>
          each.candidateId.equals(proposal.candidateId),
        )?.replay.replayId ?? null;
      const heldOutReplay = heldOutId ? found(heldOutId) : null;
      const searched = scoredOn(
        searchReplay,
        search.split.searchedRuns,
        currency,
      );
      const heldOut = scoredOn(
        heldOutReplay,
        search.split.heldOutRuns,
        currency,
      );

      const gain = gains.get(proposal.candidateId.value);

      return {
        candidateId: proposal.candidateId,
        searchedGain: gain?.searched ?? null,
        heldOutGain: gain?.heldOut ?? null,
        searchedPairs: pairsOf(searchReplay, search.split.searchedRuns),
        heldOutPairs: pairsOf(heldOutReplay, search.split.heldOutRuns),
        searchedSignificance: gain?.searched?.significance ?? null,
        heldOutSignificance: gain?.heldOut?.significance ?? null,
        regressions: gain?.regressions ?? NO_REGRESSIONS,
        replayId: proposal.replay.replayId,
        heldOutReplayId: heldOutId,
        seed: false,
        finished: finished(searchReplay),
        searchScore: searched.score,
        searchInterval: searched.interval,
        searchScored: searched.scored,
        heldOutScore: finished(heldOutReplay) ? heldOut.score : null,
        heldOutInterval: finished(heldOutReplay) ? heldOut.interval : null,
        costPerRun: searched.costPerRun,
        spent: searched.spent.plus(heldOut.spent),
      };
    }),
  };
};

interface SearchGains {
  readonly searched: GainEstimate | null;
  readonly heldOut: GainEstimate | null;
  readonly regressions: SearchRegressions;
}

interface SeedComparison {
  readonly gain: GainEstimate | null;
  readonly regressions: number | null;
}

interface SeedComparisonOptions {
  readonly gain: boolean;
  readonly regressions: boolean;
}

const compareWithSeed = (
  candidate: Replay | null,
  seed: Replay | null,
  options: SeedComparisonOptions,
  runSubset: readonly RunId[],
  minGain: number,
): SeedComparison =>
  candidate && seed
    ? {
        gain: options.gain
          ? gainBetween(candidate, seed, minGain, runSubset)
          : null,
        regressions: options.regressions
          ? countRegressions(candidate, seed, runSubset)
          : null,
      }
    : { gain: null, regressions: null };

const searchGainsOf = (
  search: Search,
  replays: readonly Replay[],
  minGain: number,
): ReadonlyMap<string, SearchGains> => {
  const found = (id: ReplayId | null | undefined): Replay | null =>
    (id && replays.find((each) => each.id.equals(id))) || null;
  const seed = found(search.seed.replay.replayId);

  return new Map(
    search.proposals.map((proposal) => {
      const searchReplay = found(proposal.replay.replayId);
      const heldOutReplay = found(
        search.heldOut.find((each) =>
          each.candidateId.equals(proposal.candidateId),
        )?.replay.replayId,
      );
      const heldOutComparable = finished(heldOutReplay) && finished(seed);
      const searched = compareWithSeed(
        searchReplay,
        seed,
        {
          gain: finished(searchReplay),
          regressions: finished(searchReplay) && finished(seed),
        },
        search.split.searchedRuns,
        minGain,
      );
      const heldOut = compareWithSeed(
        heldOutReplay,
        seed,
        { gain: heldOutComparable, regressions: heldOutComparable },
        search.split.heldOutRuns,
        minGain,
      );

      return [
        proposal.candidateId.value,
        {
          searched: searched.gain,
          heldOut: heldOut.gain,
          regressions: regressionsOf(searched.regressions, heldOut.regressions),
        },
      ];
    }),
  );
};
