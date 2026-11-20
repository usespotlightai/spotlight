import { useQueryClient } from '@tanstack/react-query';

import { memberKeys } from '@/hooks/api/useMembers';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';

export function useRefreshMembers(slug: string | undefined) {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: memberKeys.all }),
      queryClient.invalidateQueries({
        queryKey: workspaceMemberKeys.forWorkspace(slug),
      }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(slug) }),
    ]);
}
