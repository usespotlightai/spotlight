import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useInvites';
import { revokeInvite } from '@/lib/api';

export function useRevokeInvite(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      await revokeInvite({
        path: { teamId: teamId as string, inviteId },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inviteKeys.forTeam(teamId) });
    },
  });
}
