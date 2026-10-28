import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';

export const PICK_PHASES = ['choosing', 'opening'] as const;

export type PickPhase = (typeof PICK_PHASES)[number];

export interface PickingSearch {
  readonly id: SearchId;
  readonly awaitsPick: boolean;
  readonly pickedCandidate: CandidateId | null;
}

export const pendingPickOf = (
  newest: PickingSearch | null,
  pickHasPullRequest: boolean,
): PickPhase | null => {
  if (!newest) {
    return null;
  }
  if (newest.awaitsPick) {
    return 'choosing';
  }

  return newest.pickedCandidate !== null && !pickHasPullRequest
    ? 'opening'
    : null;
};
