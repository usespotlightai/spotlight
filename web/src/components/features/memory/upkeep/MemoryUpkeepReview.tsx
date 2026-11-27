import { SearchX } from 'lucide-react';
import type { ReactElement } from 'react';

import { MemoryUpkeepSkeleton } from '@/components/features/memory/upkeep/MemoryUpkeepSkeleton';
import { UpkeepProposalCard } from '@/components/features/memory/upkeep/UpkeepProposalCard';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  useDecideUpkeepProposal,
  useMemoryUpkeep,
} from '@/hooks/api/useMemoryUpkeep';
import { notFound } from '@/lib/error';
import { stillPending } from '@/lib/memory-upkeep';
import { failed, loading } from '@/lib/query';

type MemoryUpkeepReviewProps = {
  slug: string;
  teamId: string;
  upkeepId: string;
};

export function MemoryUpkeepReview({
  slug,
  teamId,
  upkeepId,
}: MemoryUpkeepReviewProps): ReactElement {
  const found = useMemoryUpkeep(teamId, upkeepId);
  const decide = useDecideUpkeepProposal();
  const upkeep = found.data;

  if (loading(found)) {
    return <MemoryUpkeepSkeleton />;
  }

  if (failed(found) && !notFound(found.error)) {
    return (
      <CouldNotLoad
        what="The proposed memory changes"
        retrying={found.isFetching}
        onRetry={() => void found.refetch()}
      />
    );
  }

  if (!upkeep) {
    return (
      <EmptyState
        icon={SearchX}
        title="These memory changes are gone"
        className="mx-auto mt-16"
      >
        The team or the sweep that proposed them no longer exists.
      </EmptyState>
    );
  }

  const left = stillPending(upkeep);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {left === 0
          ? 'Each change is decided.'
          : `${left} of ${upkeep.proposals.length} changes wait for a decision. A change you keep stays as it is.`}
      </p>

      {upkeep.proposals.map((proposal) => (
        <UpkeepProposalCard
          key={proposal.id}
          slug={slug}
          teamId={teamId}
          proposal={proposal}
          pending={
            decide.isPending && decide.variables.proposalId === proposal.id
          }
          onDecide={(decision) =>
            decide.mutate({
              slug,
              teamId,
              upkeepId,
              proposalId: proposal.id,
              decision,
            })
          }
        />
      ))}
    </div>
  );
}
