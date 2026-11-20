import { type RefObject, useRef } from 'react';

import { ProposedTaskCard } from '@/components/features/agent/ProposedTaskCard';
import { useAcceptProposal } from '@/hooks/api/useAcceptProposal';
import { useDismissProposal } from '@/hooks/api/useDismissProposal';
import { useRestoreProposal } from '@/hooks/api/useRestoreProposal';
import { useFocusAfterDecision } from '@/hooks/useFocusAfterDecision';
import { useProposalOutcome } from '@/hooks/useProposalOutcome';
import type { Attachment } from '@/lib/attachment';
import type { Proposal } from '@/lib/chat';

type ChatProposalProps = {
  slug: string;
  teamId: string;
  chatId: string;
  position: number;
  proposal: Proposal;
  attachments: readonly Attachment[];
  awaiting: RefObject<Set<number>>;
};

export function ChatProposal({
  slug,
  teamId,
  chatId,
  position,
  proposal,
  attachments,
  awaiting,
}: ChatProposalProps) {
  const accept = useAcceptProposal();
  const dismiss = useDismissProposal();
  const restore = useRestoreProposal();
  const pending = accept.isPending || dismiss.isPending || restore.isPending;
  const card = useRef<HTMLElement>(null);
  const decided = useFocusAfterDecision(card, `${proposal.state}:${pending}`);
  const { awaitOutcome, stopAwaiting } = useProposalOutcome(
    slug,
    teamId,
    proposal,
    card,
    { awaiting, position },
  );

  return (
    <ProposedTaskCard
      ref={card}
      slug={slug}
      teamId={teamId}
      proposal={proposal}
      attachments={attachments}
      pending={pending}
      onCreate={() => {
        decided();
        awaitOutcome();
        accept.mutate({ teamId, chatId, position }, { onError: stopAwaiting });
      }}
      onDismiss={() => {
        decided();
        dismiss.mutate({ teamId, chatId, position });
      }}
      onRestore={() => {
        decided();
        restore.mutate({ teamId, chatId, position });
      }}
    />
  );
}
