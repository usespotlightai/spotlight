import type { CandidateSearch } from '@replays/domain/aggregates/candidate.aggregate';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';

interface SearchColumns {
  readonly searchId: string | null;
  readonly iteration: number | null;
  readonly hypothesis: string | null;
}

export const candidateSearchOf = (row: SearchColumns): CandidateSearch | null =>
  row.searchId !== null && row.iteration !== null && row.hypothesis !== null
    ? {
        searchId: SearchId.of(row.searchId),
        iteration: row.iteration,
        hypothesis: Hypothesis.of(row.hypothesis),
      }
    : null;
