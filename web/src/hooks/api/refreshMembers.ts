import type { QueryClient } from '@tanstack/react-query';

import { memberKeys } from '@/hooks/api/useMembers';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';

export function refreshMembers(
  queryClient: QueryClient,
  slug: string | undefined,
): Promise<[void, void, void]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: memberKeys.all }),
    queryClient.invalidateQueries({
      queryKey: workspaceMemberKeys.forWorkspace(slug),
    }),
    queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(slug) }),
  ]);
}
