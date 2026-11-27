import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { leaveWorkspace } from '@/lib/api';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export function useLeaveWorkspace(
  slug: string | undefined,
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await leaveWorkspace({
        path: { slug: required(slug) },
      });

      if (error !== undefined) {
        throw new Error(
          messageOf(error, 'Sorry, you couldn’t leave the workspace.'),
        );
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}
