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

type Awaited = {
  readonly awaiting: RefObject<Set<number>>;
  readonly position: number;
};

type ProposalOutcomeResult = {
  awaitOutcome: () => void;
  stopAwaiting: () => void;
};

export function useProposalOutcome(
  slug: string,
  teamId: string,
  proposal: Proposal,
  card: RefObject<HTMLElement | null>,
  { awaiting, position }: Awaited,
): ProposalOutcomeResult {
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const seen = useRef(proposal.state);

  useEffect(() => {
    const before = seen.current;
    seen.current = proposal.state;

    if (!awaiting.current.has(position)) {
      return;
    }

    if (
      proposal.state === 'created' &&
      typeof proposal.taskId === 'string' &&
      proposal.taskId !== ''
    ) {
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
  }, [proposal, slug, teamId, card, navigate, trail, awaiting, position]);

  return {
    awaitOutcome: () => {
      awaiting.current.add(position);
    },
    stopAwaiting: () => {
      awaiting.current.delete(position);
    },
  };
}
