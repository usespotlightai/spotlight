import { useQuery } from '@tanstack/react-query';
import { listWorkspaces } from '@/lib/api';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  detail: (slug?: string) => ['workspaces', slug ?? null] as const,
};

export function useWorkspaces(enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.all,
    enabled,
    queryFn: async () => {
      const { data } = await listWorkspaces({ throwOnError: true });
      return data;
    },
  });
}
