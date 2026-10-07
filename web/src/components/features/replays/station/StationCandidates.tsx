import type { UseQueryResult } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { CardList } from '@/components/features/replays/CardList';
import { StateBox } from '@/components/features/replays/StateBox';
import { CandidateRow } from '@/components/features/replays/station/CandidateRow';
import { CandidatesSkeleton } from '@/components/features/replays/station/CandidatesSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { failed, loading } from '@/lib/query';
import { candidatesInOrder, type ReplayCandidate } from '@/lib/replay';

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
        <EmptyState icon={FlaskConical} title="No candidates yet">
          A candidate is a changed station config to replay. It’s never applied.
          Propose one with the CLI.
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

  return body;
}
