import {
  type QueryKeyWithDataTag,
  type UnusedSkipTokenOptions,
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { getWorkspace, type WorkspaceResponseDto } from '@/lib/api';
import { required } from '@/lib/required';
import { setupStatusPollFor } from '@/lib/setup-status';

type WorkspaceKey = ReturnType<typeof workspaceKeys.detail>;

type WorkspaceQuery = UnusedSkipTokenOptions<
  WorkspaceResponseDto | null,
  Error,
  WorkspaceResponseDto | null,
  WorkspaceKey
> &
  QueryKeyWithDataTag<WorkspaceKey, WorkspaceResponseDto | null>;

export const workspaceQuery = (slug: string | undefined): WorkspaceQuery =>
  queryOptions({
    queryKey: workspaceKeys.detail(slug),
    enabled: Boolean(slug),
    retry: false,
    refetchInterval: (query) =>
      setupStatusPollFor(query.state.data?.setupStatus),
    queryFn: async () => {
      const { data, response } = await getWorkspace({
        path: { slug: required(slug) },
      });

      if (response?.status === 404) {
        return null;
      }
      if (!data) {
        throw new Error('Sorry, the workspace couldn’t be loaded.');
      }
      return data;
    },
  });

export function useWorkspace(
  slug: string | undefined,
): UseQueryResult<WorkspaceResponseDto | null> {
  return useQuery(workspaceQuery(slug));
}
