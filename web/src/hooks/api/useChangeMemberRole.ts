import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberKeys } from '@/hooks/api/useMembers';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { changeMemberRole } from '@/lib/api';
import type { Role } from '@/lib/role';

export function useChangeMemberRole(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (change: { userId: string; role: Role }) => {
      await changeMemberRole({
        path: { slug: slug as string, userId: change.userId },
        body: { role: change.role },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
      queryClient.invalidateQueries({
        queryKey: workspaceMemberKeys.forWorkspace(slug),
      });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(slug) });
    },
  });
}
