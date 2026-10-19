import { X } from 'lucide-react';
import { CandidateChanges } from '@/components/features/searches/search/CandidateChanges';
import { CandidateHeading } from '@/components/features/searches/search/CandidateHeading';
import { CandidateReplayLinks } from '@/components/features/searches/search/CandidateReplayLinks';
import { CandidateResults } from '@/components/features/searches/search/CandidateResults';
import { PickCandidate } from '@/components/features/searches/search/PickCandidate';
import { PaneSection } from '@/components/shared/PaneSection';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import type { ReplayedStation } from '@/lib/replay';
import { candidateName, type SearchCandidate } from '@/lib/search';
import {
  CHANGES_TITLE,
  HYPOTHESIS_TITLE,
  RESULTS_TITLE,
} from '@/lib/search-words';

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
  live: SearchCandidate;
  currency: string;
  maxRegressions: number | null;
  open: boolean;
  onClose: () => void;
};

export function CandidateDetail({
  at,
  searchId,
  candidate,
  live,
  currency,
  maxRegressions,
  open,
  onClose,
}: CandidateDetailProps) {
  return (
    <SidePane pane={CANDIDATE_PANE} open={open}>
      <div className="flex items-center gap-2 px-4 py-2">
        <h2 className="sr-only">{candidateName(candidate)}</h2>
        <div className="min-w-0 flex-1 text-sm">
          <CandidateHeading
            candidate={candidate}
            maxRegressions={maxRegressions}
          />
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
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-6 scrollbar-hide"
      >
        <PaneSection title={CHANGES_TITLE}>
          <CandidateChanges candidate={candidate} />
        </PaneSection>

        {candidate.hypothesis && (
          <PaneSection title={HYPOTHESIS_TITLE}>
            <p className="whitespace-pre-line text-foreground text-sm leading-6">
              {candidate.hypothesis}
            </p>
          </PaneSection>
        )}

        <PaneSection
          title={RESULTS_TITLE}
          action={<CandidateReplayLinks at={at} candidate={candidate} />}
        >
          <CandidateResults
            candidate={candidate}
            live={live}
            currency={currency}
          />
        </PaneSection>

        <PickCandidate
          teamId={at.teamId}
          searchId={searchId}
          candidate={candidate}
        />
      </div>
    </SidePane>
  );
}
