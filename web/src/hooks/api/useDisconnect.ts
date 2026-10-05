import { useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionKeys } from '@/hooks/api/useConnections';
import { disconnectMine } from '@/lib/api';

export function useDisconnect(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (source: string) => {
      await disconnectMine({
        path: { teamId, source },
        throwOnError: true,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: connectionKeys.forTeam(teamId),
      }),
  });
}
