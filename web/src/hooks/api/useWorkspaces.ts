import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  listMemberWorkspaces,
  type WorkspaceListingResponseDto,
} from '@/lib/api';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  detail: (slug?: string) => ['workspaces', slug ?? null] as const,
};

export function useWorkspaces(
  enabled = true,
): UseQueryResult<WorkspaceListingResponseDto[]> {
  return useQuery({
    queryKey: workspaceKeys.all,
    enabled,
    queryFn: async () => {
      const { data } = await listMemberWorkspaces({ throwOnError: true });
      return data;
    },
  });
}
