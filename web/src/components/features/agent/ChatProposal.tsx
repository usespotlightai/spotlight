import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { ProposedTaskCard } from '@/components/features/agent/ProposedTaskCard';
import { useAcceptProposal } from '@/hooks/api/useAcceptProposal';
import { useDismissProposal } from '@/hooks/api/useDismissProposal';
import type { Proposal } from '@/lib/chat';
import { taskPath } from '@/lib/task';
import { toast } from '@/lib/toast';
import { useForwardTrail } from '@/lib/trail';

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
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const awaiting = useRef(false);
  const seen = useRef(proposal.state);

  useEffect(() => {
    const before = seen.current;
    seen.current = proposal.state;

    if (!awaiting.current || before === proposal.state) {
      return;
    }

    if (proposal.state !== 'accepted') {
      awaiting.current = false;
    }

    if (proposal.state === 'created' && proposal.taskId) {
      const to = taskPath(slug, teamId, proposal.taskId);

      toast.add({
        type: 'success',
        title: 'Task created',
        description: proposal.title,
        timeout: 10_000,
        actionProps: {
          children: 'Open task',
          onClick: () => navigate(to, { state: { trail } }),
        },
      });
    } else if (proposal.state === 'open' && before === 'accepted') {
      toast.add({
        type: 'error',
        title: 'Sorry, the task was not created',
        description: 'The station is not on the line. Please try again.',
      });
    }
  }, [proposal, slug, teamId, navigate, trail]);

  return (
    <ProposedTaskCard
      slug={slug}
      teamId={teamId}
      proposal={proposal}
      pending={accept.isPending || dismiss.isPending}
      onCreate={() =>
        accept.mutate(
          { teamId, chatId, position },
          {
            onSuccess: () => {
              awaiting.current = true;
            },
          },
        )
      }
      onDismiss={() => dismiss.mutate({ teamId, chatId, position })}
    />
  );
}
