import { type RefObject, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { ProposedTaskCard } from '@/components/features/agent/ProposedTaskCard';
import { useAcceptProposal } from '@/hooks/api/useAcceptProposal';
import { useDismissProposal } from '@/hooks/api/useDismissProposal';
import { useRestoreProposal } from '@/hooks/api/useRestoreProposal';
import { useFocusAfterDecision } from '@/hooks/useFocusAfterDecision';
import type { Attachment } from '@/lib/attachment';
import type { Proposal } from '@/lib/chat';
import { taskPath } from '@/lib/task';
import { toast } from '@/lib/toast';
import { useForwardTrail } from '@/lib/trail';

const inView = (element: HTMLElement | null): boolean => {
  const box = element?.getBoundingClientRect();

  return Boolean(
    box && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight,
  );
};

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
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const card = useRef<HTMLElement>(null);
  const decided = useFocusAfterDecision(card, `${proposal.state}:${pending}`);
  const seen = useRef(proposal.state);

  useEffect(() => {
    const before = seen.current;
    seen.current = proposal.state;

    if (!awaiting.current.has(position)) {
      return;
    }

    if (proposal.state === 'created' && proposal.taskId) {
      awaiting.current.delete(position);
      if (inView(card.current)) {
        return;
      }
      const to = taskPath(slug, teamId, proposal.taskId);

      toast.add({
        type: 'success',
        title: 'Task created',
        description: proposal.title,
        timeout: 10_000,
        actionProps: {
          children: 'Open task',
          onClick: () => void navigate(to, { state: { trail } }),
        },
      });
    } else if (proposal.state === 'open' && before === 'accepted') {
      awaiting.current.delete(position);
      toast.add({
        type: 'error',
        title: 'Sorry, the task was not created',
        description: 'The station is not on the line. Please try again.',
      });
    } else if (proposal.state === 'dismissed') {
      awaiting.current.delete(position);
    }
  }, [proposal, slug, teamId, navigate, trail, awaiting, position]);

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
        awaiting.current.add(position);
        accept.mutate(
          { teamId, chatId, position },
          {
            onError: () => {
              awaiting.current.delete(position);
            },
          },
        );
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
