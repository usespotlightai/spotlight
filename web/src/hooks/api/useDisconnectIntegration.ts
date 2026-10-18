import { useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionKeys } from '@/hooks/api/useIntegrationConnections';
import { disconnectIntegration } from '@/lib/api';

export function useDisconnectIntegration(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integration: string) => {
      await disconnectIntegration({
        path: { teamId, integration },
        throwOnError: true,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: connectionKeys.forTeam(teamId),
      }),
  });
}
