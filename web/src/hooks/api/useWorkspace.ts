import { queryOptions, useQuery } from '@tanstack/react-query';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { getWorkspace } from '@/lib/api';
import { provisioningPollFor } from '@/lib/provisioning';

export const workspaceQuery = (slug: string | undefined) =>
  queryOptions({
    queryKey: workspaceKeys.detail(slug),
    enabled: Boolean(slug),
    retry: false,
    refetchInterval: (query) =>
      provisioningPollFor(query.state.data?.provisioning),
    queryFn: async () => {
      const { data, response } = await getWorkspace({
        path: { slug: slug as string },
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

export function useWorkspace(slug: string | undefined) {
  return useQuery(workspaceQuery(slug));
}
