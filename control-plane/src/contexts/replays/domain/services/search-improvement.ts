import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { gainBetween } from '@replays/domain/services/gain-estimate';
import {
  isCheaperAtParity,
  rankedOf,
} from '@replays/domain/services/search-ranking';
import { scoredOn, scoresOf } from '@replays/domain/services/search-scores';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';

export const improvedOnBestBefore = (
  search: Search,
  replayId: ReplayId,
  replays: readonly Replay[],
  minGain: number,
): boolean => {
  const at = search.iterations.findIndex((each) =>
    each.proposals.some((proposal) => proposal.replay.is(replayId)),
  );
  const candidate = replays.find((each) => each.id.equals(replayId));

  if (at < 0 || candidate?.current !== 'finished') {
    return false;
  }

  const before = new Set(
    search.iterations
      .slice(0, at)
      .flatMap((each) => each.proposals)
      .map((each) => each.candidateId.value),
  );
  const scores = scoresOf(search, replays, minGain);
  const [best] = rankedOf(
    [scores.seed, ...scores.candidates].filter(
      (each) =>
        each.finished && (each.seed || before.has(each.candidateId.value)),
    ),
    search.objective,
  );
  const bestReplay = replays.find((each) =>
    each.id.equals(best?.replayId ?? search.seed.replay.replayId),
  );

  if (!bestReplay) {
    return false;
  }

  const runSubset = search.split.searchedRuns;
  const estimate = gainBetween(candidate, bestReplay, minGain, runSubset);

  if (!estimate) {
    return false;
  }
  if (search.objective === 'success') {
    return estimate.significance === 'better';
  }

  const currency = search.budget.ceiling.currency;
  const cost = scoredOn(candidate, runSubset, currency).costPerRun;
  const bestCost = scoredOn(bestReplay, runSubset, currency).costPerRun;

  return isCheaperAtParity(estimate.significance, cost, bestCost);
};
