import { X } from 'lucide-react';
import { ChangedFromLive } from '@/components/features/replays/ChangedFromLive';
import { CandidateGains } from '@/components/features/searches/search/CandidateGains';
import { CandidateHeading } from '@/components/features/searches/search/CandidateHeading';
import { CandidateReplayLinks } from '@/components/features/searches/search/CandidateReplayLinks';
import { CandidateScores } from '@/components/features/searches/search/CandidateScores';
import { PickCandidate } from '@/components/features/searches/search/PickCandidate';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import type { ReplayedStation } from '@/lib/replay';
import {
  candidateName,
  type SearchCandidate,
  searchChanges,
} from '@/lib/search';

const CANDIDATE_PANE: PaneConfig = {
  storageKey: 'spotlight.search-candidate-width',
  min: 320,
  max: 960,
  initial: 480,
  label: 'Resize the candidate’s details',
};

type CandidateDetailProps = {
  at: ReplayedStation;
  searchId: string;
  candidate: SearchCandidate;
  currency: string;
  open: boolean;
  onClose: () => void;
};

export function CandidateDetail({
  at,
  searchId,
  candidate,
  currency,
  open,
  onClose,
}: CandidateDetailProps) {
  return (
    <SidePane pane={CANDIDATE_PANE} open={open}>
      <div className="flex items-center gap-2 px-4 py-2">
        <h2 className="sr-only">{candidateName(candidate)}</h2>
        <div className="min-w-0 flex-1 text-sm">
          <CandidateHeading candidate={candidate} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the candidate’s details"
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div
        data-slot="candidate-detail"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6 scrollbar-hide"
      >
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
      </div>
    </SidePane>
  );
}
