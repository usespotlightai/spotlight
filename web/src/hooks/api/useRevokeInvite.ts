import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { revokeInvite } from '@/lib/api';

export function useRevokeInvite(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      await revokeInvite({
        path: { slug: slug as string, inviteId },
        throwOnError: true,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: inviteKeys.forWorkspace(slug),
      }),
  });
}
