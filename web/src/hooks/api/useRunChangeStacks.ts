import { useQuery } from '@tanstack/react-query';
import { listRunChangeStacks } from '@/lib/api';
import { inProgress } from '@/lib/change-stack';

export const changeStackKeys = {
  forRun: (runId?: string) => ['change-stacks', runId ?? null] as const,
};

const POLL_MS = 5_000;

export function useRunChangeStacks(teamId?: string, runId?: string) {
  return useQuery({
    queryKey: changeStackKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    refetchInterval: (query) =>
      query.state.data && inProgress(query.state.data.stacks) ? POLL_MS : false,
    queryFn: async () => {
      const { data } = await listRunChangeStacks({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
