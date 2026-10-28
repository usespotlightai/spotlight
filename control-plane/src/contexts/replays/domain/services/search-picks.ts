import { overfitOf } from '@replays/domain/services/overfit';
import {
  isCheaperAtParity,
  rankedOf,
} from '@replays/domain/services/search-ranking';
import { exceedsRegressionLimit } from '@replays/domain/services/search-regressions';
import type { SearchScores } from '@replays/domain/services/search-scores';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type {
  SearchPick,
  SearchPickDecline,
} from '@replays/domain/value-objects/search-pick';

type Scored = SearchScores['candidates'][number];

export interface PickConstraints {
  readonly rejected: readonly CandidateId[];
  readonly pullRequestOpen: boolean;
}

export const NO_CONSTRAINTS: PickConstraints = {
  rejected: [],
  pullRequestOpen: false,
};

const declineOf = (
  candidate: Scored,
  seed: Scored,
  objective: SearchObjective,
  threshold: ReplayThreshold | null,
): SearchPickDecline | null => {
  if (objective === 'success' && candidate.heldOutSignificance !== 'better') {
    return 'no-held-out-gain';
  }
  if (
    objective === 'cost' &&
    !isCheaperAtParity(
      candidate.heldOutSignificance,
      candidate.costPerRun,
      seed.costPerRun,
    )
  ) {
    return 'not-cheaper';
  }
  if (exceedsRegressionLimit(candidate.regressions, threshold)) {
    return 'over-regression-limit';
  }
  if (overfitOf(candidate.searchedGain, candidate.heldOutGain) !== null) {
    return 'likely-overfit';
  }

  return null;
};

export const autoPickOf = (
  scores: SearchScores,
  objective: SearchObjective,
  threshold: ReplayThreshold | null,
  constraints: PickConstraints,
): SearchPick => {
  const heldOut = scores.candidates.filter(
    (each) => each.heldOutScore !== null,
  );
  const ranked = rankedOf([scores.seed, ...heldOut], objective).filter(
    (each) => !each.seed,
  );
  const top = ranked[0] ?? heldOut[0];

  if (!top) {
    return { outcome: 'declined', reason: 'no-candidate' };
  }

  const passing = ranked.filter(
    (each) => declineOf(each, scores.seed, objective, threshold) === null,
  );
  const fresh = passing.find(
    (each) =>
      !constraints.rejected.some((rejected) =>
        rejected.equals(each.candidateId),
      ),
  );

  if (fresh && constraints.pullRequestOpen) {
    return { outcome: 'declined', reason: 'pull-request-open' };
  }
  if (fresh) {
    return { outcome: 'picked', candidateId: fresh.candidateId };
  }

  return {
    outcome: 'declined',
    reason:
      passing.length > 0
        ? 'rejected-before'
        : (declineOf(top, scores.seed, objective, threshold) ?? 'no-candidate'),
  };
};
