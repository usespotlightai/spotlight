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

    if (!awaiting.current) {
      return;
    }

    if (proposal.state === 'created' && proposal.taskId) {
      awaiting.current = false;
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
      awaiting.current = false;
      toast.add({
        type: 'error',
        title: 'Sorry, the task was not created',
        description: 'The station is not on the line. Please try again.',
      });
    } else if (proposal.state === 'dismissed') {
      awaiting.current = false;
    }
  }, [proposal, slug, teamId, navigate, trail]);

  return (
    <ProposedTaskCard
      slug={slug}
      teamId={teamId}
      proposal={proposal}
      pending={accept.isPending || dismiss.isPending}
      onCreate={() => {
        awaiting.current = true;
        accept.mutate(
          { teamId, chatId, position },
          {
            onError: () => {
              awaiting.current = false;
            },
          },
        );
      }}
      onDismiss={() => dismiss.mutate({ teamId, chatId, position })}
    />
  );
}
