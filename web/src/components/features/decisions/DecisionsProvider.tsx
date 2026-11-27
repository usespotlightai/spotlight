import { type ReactNode, useMemo } from 'react';

import { useDisputeDecision } from '@/hooks/api/useDisputeDecision';
import { useTaskDecisions } from '@/hooks/api/useTaskDecisions';
import type { Decision } from '@/lib/decision';
import { DecisionsContext } from '@/lib/decisions-context';
import { nonEmpty } from '@/lib/non-empty';
import { runPath } from '@/lib/run';

type DecisionsProviderProps = {
  slug: string;
  teamId: string;
  taskId: string | null | undefined;
  children: ReactNode;
};

export function DecisionsProvider({
  slug,
  teamId,
  taskId,
  children,
}: DecisionsProviderProps) {
  const { data: found } = useTaskDecisions(teamId, taskId ?? undefined);
  const disputeDecision = useDisputeDecision();
  const { isPending, mutateAsync } = disputeDecision;

  const deciding = useMemo(
    () =>
      found && nonEmpty(taskId)
        ? {
            found,
            reasoningAt: (decision: Decision) =>
              runPath(slug, teamId, decision.runId),
            disputing: {
              pending: isPending,
              dispute: (decisionId: string, path: string, reason: string) =>
                mutateAsync({ teamId, taskId, decisionId, path, reason }),
            },
          }
        : null,
    [found, slug, teamId, taskId, isPending, mutateAsync],
  );

  return <DecisionsContext value={deciding}>{children}</DecisionsContext>;
}
