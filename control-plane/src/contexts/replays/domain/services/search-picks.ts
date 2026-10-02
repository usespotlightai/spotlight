import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { CandidateUnpickableError } from '@replays/domain/exceptions/candidate-unpickable.error';
import { UnknownCandidateError } from '@replays/domain/exceptions/unknown-candidate.error';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';

export const pickedFrom = (
  search: Search,
  candidateId: CandidateId,
): SearchProposal => {
  if (search.seed.candidateId.equals(candidateId)) {
    throw new CandidateUnpickableError(
      'The seed is the station’s live config already; pick a candidate the search proposed',
    );
  }

  const proposal = search.proposals.find((each) =>
    each.candidateId.equals(candidateId),
  );

  if (!proposal) {
    throw new UnknownCandidateError(candidateId.value);
  }
  if (!proposal.replay.hasFinished) {
    throw new CandidateUnpickableError(
      `The candidate ${proposal.name.value} has no finished replay on the searched tasks; pick it once its replay finishes`,
    );
  }

  return proposal;
};
