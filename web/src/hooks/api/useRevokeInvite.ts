import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { revokeInvite } from '@/lib/api';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export function useRevokeInvite(
  slug: string | undefined,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await revokeInvite({
        path: { slug: required(slug), inviteId },
      });

      if (error !== undefined) {
        throw new Error(
          messageOf(error, 'Sorry, the invite couldn’t be revoked.'),
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: inviteKeys.forWorkspace(slug),
      }),
  });
}
