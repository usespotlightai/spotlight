import { useQuery } from '@tanstack/react-query';
import { listWorkspaceTokens } from '@/lib/api';

export const tokenKeys = {
  forWorkspace: (workspaceId?: string) =>
    ['workspace-tokens', workspaceId ?? null] as const,
};

export function useWorkspaceTokens(workspaceId: string | undefined) {
  return useQuery({
    queryKey: tokenKeys.forWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data } = await listWorkspaceTokens({
        path: { workspaceId: workspaceId as string },
        throwOnError: true,
      });
      return data.items;
    },
  });
}
