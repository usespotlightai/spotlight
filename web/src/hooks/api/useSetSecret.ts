import { useMutation, useQueryClient } from '@tanstack/react-query';
import { configurationKeys } from '@/hooks/api/useConfiguration';
import { setSecret } from '@/lib/api';

/**
 * Writes a secret the workspace's integrations verify with. It goes one way:
 * nothing here or anywhere else reads it back out.
 */
export function useSetSecret(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (secret: { name: string; value: string }) => {
      await setSecret({
        path: { teamId: teamId as string },
        body: secret,
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: configurationKeys.forTeam(teamId),
      });
    },
  });
}
