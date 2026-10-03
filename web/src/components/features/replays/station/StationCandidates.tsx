import type { UseQueryResult } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { CardList } from '@/components/features/replays/CardList';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { StateBox } from '@/components/features/replays/StateBox';
import { CandidateRow } from '@/components/features/replays/station/CandidateRow';
import { CandidatesSkeleton } from '@/components/features/replays/station/CandidatesSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { buttonVariants } from '@/components/ui/button-variants';
import { failed, loading } from '@/lib/query';
import {
  candidatesInOrder,
  PROPOSE_ANCHOR,
  type ReplayCandidate,
} from '@/lib/replay';
import { cn } from '@/lib/utils';

type StationCandidatesProps = {
  candidates: UseQueryResult<ReplayCandidate[]>;
  waiting: boolean;
  failedToPlace: boolean;
};

export function StationCandidates({
  candidates,
  waiting,
  failedToPlace,
}: StationCandidatesProps) {
  const listed = candidatesInOrder(candidates.data ?? []);

  let body: ReactNode;

  if (failedToPlace || failed(candidates)) {
    body = (
      <StateBox>
        <CouldNotLoad
          what="The station’s candidates"
          retrying={candidates.isFetching}
          onRetry={() => void candidates.refetch()}
        />
      </StateBox>
    );
  } else if (waiting || loading(candidates)) {
    body = <CandidatesSkeleton />;
  } else if (listed.length === 0) {
    body = (
      <StateBox>
        <EmptyState
          icon={FlaskConical}
          title="No candidates yet"
          action={
            <a
              href={`#${PROPOSE_ANCHOR}`}
              className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
            >
              See how to propose one
            </a>
          }
        >
          A candidate is a changed config for this station, proposed to be
          replayed. It is never applied.
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <CardList label="Candidates">
        {listed.map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
      </CardList>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ReplaysHeading title="Candidates" />
      {body}
    </div>
  );
}
