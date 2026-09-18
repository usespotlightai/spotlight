import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useInvites';
import { inviteToTeam } from '@/lib/api';

export function useInviteToTeam(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await inviteToTeam({
        path: { teamId: teamId as string },
        body: { email },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inviteKeys.forTeam(teamId) });
    },
  });
}
