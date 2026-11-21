import { useMutation, useQueryClient } from '@tanstack/react-query';

import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { leaveWorkspace } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useLeaveWorkspace(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await leaveWorkspace({
        path: { slug: slug as string },
      });

      if (error) {
        throw new Error(
          messageOf(error, 'Sorry, you couldn’t leave the workspace.'),
        );
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}
