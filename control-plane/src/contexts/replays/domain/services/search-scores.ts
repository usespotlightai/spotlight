import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { totalsOf } from '@replays/domain/services/replay-results';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface CandidateScores {
  readonly candidateId: CandidateId;
  readonly replayId: ReplayId;
  readonly heldOutReplayId: ReplayId | null;
  readonly seed: boolean;
  readonly finished: boolean;
  readonly searchScore: number | null;
  readonly searchScored: number;
  readonly heldOutScore: number | null;
  readonly costPerRun: number | null;
  readonly spent: Spend;
}

export interface SearchScores {
  readonly seed: CandidateScores;
  readonly candidates: readonly CandidateScores[];
}

interface Scored {
  readonly score: number | null;
  readonly scored: number;
  readonly costPerRun: number | null;
  readonly spent: Spend;
}

const scoredOn = (
  replay: Replay | null,
  among: readonly RunId[] | null,
  currency: string,
): Scored => {
  if (!replay) {
    return {
      score: null,
      scored: 0,
      costPerRun: null,
      spent: Spend.none(currency),
    };
  }

  const totals = totalsOf(replay, among);
  const priced =
    totals.unpriced === 0 &&
    totals.unpricedCalls === 0 &&
    totals.spentElsewhere.length === 0;

  return {
    score: totals.successRate,
    scored: totals.scored,
    costPerRun:
      priced && totals.scored > 0 ? totals.spent.amount / totals.scored : null,
    spent: totals.spent,
  };
};

const finished = (replay: Replay | null): boolean =>
  replay?.current === 'finished';

export const scoresOf = (
  search: Search,
  replays: readonly Replay[],
): SearchScores => {
  const currency = search.budget.ceiling.currency;
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
      replayId: search.seed.replay.replayId,
      heldOutReplayId: null,
      seed: true,
      finished: finished(seedReplay),
      searchScore: seedSearched.score,
      searchScored: seedSearched.scored,
      heldOutScore: finished(seedReplay) ? seedHeldOut.score : null,
      costPerRun: seedSearched.costPerRun,
      spent: seedReplay?.spent ?? Spend.none(currency),
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

      return {
        candidateId: proposal.candidateId,
        replayId: proposal.replay.replayId,
        heldOutReplayId: heldOutId,
        seed: false,
        finished: finished(searchReplay),
        searchScore: searched.score,
        searchScored: searched.scored,
        heldOutScore: finished(heldOutReplay) ? heldOut.score : null,
        costPerRun: searched.costPerRun,
        spent: searched.spent.plus(heldOut.spent),
      };
    }),
  };
};
