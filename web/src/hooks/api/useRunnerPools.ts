import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listRunnerPools, type RunnerPoolResourceResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export const runnerPoolKeys = {
  forWorkspace: (workspaceId?: string) =>
    ['runner-pools', workspaceId ?? null] as const,
};

export function useRunnerPools(
  workspaceId: string | undefined,
): UseQueryResult<RunnerPoolResourceResponseDto[]> {
  return useQuery({
    queryKey: runnerPoolKeys.forWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data } = await listRunnerPools({
        path: { workspaceId: required(workspaceId) },
        throwOnError: true,
      });
      return data.items;
    },
  });
}
