import { ProposedTaskCard } from '@/components/features/agent/ProposedTaskCard';
import { useAcceptProposal } from '@/hooks/api/useAcceptProposal';
import { useDismissProposal } from '@/hooks/api/useDismissProposal';
import type { Proposal } from '@/lib/chat';

type ChatProposalProps = {
  slug: string;
  teamId: string;
  chatId: string;
  position: number;
  proposal: Proposal;
};

export function ChatProposal({
  slug,
  teamId,
  chatId,
  position,
  proposal,
}: ChatProposalProps) {
  const accept = useAcceptProposal();
  const dismiss = useDismissProposal();

  return (
    <ProposedTaskCard
      slug={slug}
      teamId={teamId}
      proposal={proposal}
      pending={accept.isPending || dismiss.isPending}
      onCreate={() => accept.mutate({ teamId, chatId, position })}
      onDismiss={() => dismiss.mutate({ teamId, chatId, position })}
    />
  );
}
