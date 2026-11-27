import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  listWorkspaceInvites,
  type WorkspaceInviteResponseDto,
} from '@/lib/api';
import { required } from '@/lib/required';

export const inviteKeys = {
  forWorkspace: (slug?: string) => ['invites', slug ?? null] as const,
  byToken: (token?: string) => ['invite', token ?? null] as const,
};

export function useWorkspaceInvites(
  slug: string | undefined,
): UseQueryResult<WorkspaceInviteResponseDto[]> {
  return useQuery({
    queryKey: inviteKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await listWorkspaceInvites({
        path: { slug: required(slug) },
        throwOnError: true,
      });
      return data;
    },
  });
}
