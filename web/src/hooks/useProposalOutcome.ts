import { type RefObject, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

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

export function useProposalOutcome(
  slug: string,
  teamId: string,
  proposal: Proposal,
  card: RefObject<HTMLElement | null>,
) {
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
      awaiting.current = false;
      toast.add({
        type: 'error',
        title: 'Sorry, the task was not created',
        description: 'The station is not on the line. Please try again.',
      });
    } else if (proposal.state === 'dismissed') {
      awaiting.current = false;
    }
  }, [proposal, slug, teamId, card, navigate, trail]);

  return {
    awaitOutcome: () => {
      awaiting.current = true;
    },
    stopAwaiting: () => {
      awaiting.current = false;
    },
  };
}
