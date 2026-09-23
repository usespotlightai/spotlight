import { type ReactNode, useMemo } from 'react';
import { useDisputeDecision } from '@/hooks/api/useDisputeDecision';
import { useTaskDecisions } from '@/hooks/api/useTaskDecisions';
import { DecisionsContext } from '@/lib/decisions-context';
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
  const { isPending, isError, mutateAsync } = disputeDecision;

  const deciding = useMemo(
    () =>
      found && taskId
        ? {
            found,
            reasoningAt: found.runId
              ? runPath(slug, teamId, found.runId)
              : null,
            disputing: {
              pending: isPending,
              failed: isError,
              dispute: (decisionId: string, path: string, reason: string) =>
                mutateAsync({ teamId, taskId, decisionId, path, reason }),
            },
          }
        : null,
    [found, slug, teamId, taskId, isPending, isError, mutateAsync],
  );

  return <DecisionsContext value={deciding}>{children}</DecisionsContext>;
}
