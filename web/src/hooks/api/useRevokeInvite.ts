import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { revokeInvite } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useRevokeInvite(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await revokeInvite({
        path: { slug: slug as string, inviteId },
      });

      if (error) {
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
