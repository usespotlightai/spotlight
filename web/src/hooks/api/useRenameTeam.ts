import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { renameTeam } from '@/lib/api';

export function useRenameTeam(
  slug: string | undefined,
  teamId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await renameTeam({
        path: { teamId: teamId as string },
        body: { name },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(slug) });
    },
  });
}
