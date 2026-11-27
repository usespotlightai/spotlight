import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  listWorkspaceMembers,
  type WorkspaceMemberResponseDto,
} from '@/lib/api';
import { required } from '@/lib/required';

export const workspaceMemberKeys = {
  forWorkspace: (slug?: string) => ['workspace-members', slug ?? null] as const,
};

export function useWorkspaceMembers(
  slug: string | undefined,
): UseQueryResult<WorkspaceMemberResponseDto[]> {
  return useQuery({
    queryKey: workspaceMemberKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await listWorkspaceMembers({
        path: { slug: required(slug) },
        throwOnError: true,
      });
      return data;
    },
  });
}
