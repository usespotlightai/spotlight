import { ChangedFromLive } from '@/components/features/replays/ChangedFromLive';
import { CandidateGains } from '@/components/features/searches/search/CandidateGains';
import { CandidateHeading } from '@/components/features/searches/search/CandidateHeading';
import { CandidateReplayLinks } from '@/components/features/searches/search/CandidateReplayLinks';
import { CandidateScores } from '@/components/features/searches/search/CandidateScores';
import { PickCandidate } from '@/components/features/searches/search/PickCandidate';
import type { ReplayedStation } from '@/lib/replay';
import {
  type SearchCandidate,
  searchCandidateAnchor,
  searchChanges,
} from '@/lib/search';

type SearchCandidateRowProps = {
  at: ReplayedStation;
  searchId: string;
  candidate: SearchCandidate;
  currency: string;
};

export function SearchCandidateRow({
  at,
  searchId,
  candidate,
  currency,
}: SearchCandidateRowProps) {
  return (
    <li
      id={searchCandidateAnchor(candidate.candidateId)}
      data-slot="search-candidate"
      className="flex flex-col gap-1.5 rounded-md px-2 py-2 text-sm"
    >
      <CandidateHeading candidate={candidate} />

      {candidate.hypothesis && (
        <p className="whitespace-pre-line text-foreground text-sm leading-6">
          {candidate.hypothesis}
        </p>
      )}

      {candidate.seed ? (
        <p className="text-muted-foreground text-xs">
          Station as configured when the search started.
        </p>
      ) : (
        <ChangedFromLive
          changes={searchChanges(candidate)}
          same="Same as the live config."
        />
      )}

      <CandidateScores candidate={candidate} currency={currency} />
      <CandidateGains candidate={candidate} />
      <CandidateReplayLinks at={at} candidate={candidate} />

      <PickCandidate
        teamId={at.teamId}
        searchId={searchId}
        candidate={candidate}
      />
    </li>
  );
}
