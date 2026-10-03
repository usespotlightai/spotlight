import { useQuery } from '@tanstack/react-query';
import { listRunnerPools } from '@/lib/api';

export const runnerPoolKeys = {
  forWorkspace: (workspaceId?: string) =>
    ['runner-pools', workspaceId ?? null] as const,
};

export function useRunnerPools(workspaceId: string | undefined) {
  return useQuery({
    queryKey: runnerPoolKeys.forWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data } = await listRunnerPools({
        path: { workspaceId: workspaceId as string },
        throwOnError: true,
      });
      return data.items;
    },
  });
}
