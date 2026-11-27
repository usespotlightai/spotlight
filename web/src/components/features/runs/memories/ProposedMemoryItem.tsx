import { Inbox } from 'lucide-react';
import type { ReactElement } from 'react';

import { MemoryCard } from '@/components/features/runs/memories/MemoryCard';
import { MemoryHandleLink } from '@/components/features/runs/memories/MemoryHandleLink';
import { PillLink } from '@/components/shared/PillLink';
import { inboxItemPath } from '@/lib/inbox';
import { KIND_LABELS, proposalStateOf, type RunProposal } from '@/lib/memory';
import { nonEmpty } from '@/lib/non-empty';

type ProposedMemoryItemProps = {
  slug: string;
  teamId: string;
  proposal: RunProposal;
  reviewItemId: string | null;
};

export function ProposedMemoryItem({
  slug,
  teamId,
  proposal,
  reviewItemId,
}: ProposedMemoryItemProps): ReactElement {
  const waiting = proposal.state === 'proposed' && reviewItemId;

  return (
    <MemoryCard
      slot="run-proposed-memory"
      body={proposal.body}
      about={[
        KIND_LABELS[proposal.kind],
        ...(waiting !== null && waiting !== false && waiting !== ''
          ? []
          : [proposalStateOf(proposal)]),
        ...(nonEmpty(proposal.handle)
          ? [
              <MemoryHandleLink
                key="handle"
                slug={slug}
                teamId={teamId}
                memoryId={proposal.id}
                handle={proposal.handle}
              />,
            ]
          : []),
      ]}
      action={
        waiting !== null &&
        waiting !== false &&
        waiting !== '' && (
          <PillLink to={inboxItemPath(slug, waiting)}>
            <Inbox aria-hidden className="size-3" />
            {proposalStateOf(proposal)}
          </PillLink>
        )
      }
      retirable={
        proposal.status === 'active' ? { teamId, memoryId: proposal.id } : null
      }
    />
  );
}
