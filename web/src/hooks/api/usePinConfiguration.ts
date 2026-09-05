import { useMutation, useQueryClient } from '@tanstack/react-query';
import { configurationKeys } from '@/hooks/api/useConfiguration';
import { onboardingKeys } from '@/hooks/api/useOnboarding';
import { pinConfigurationRepository } from '@/lib/api';

/** Says which repository this team reads its configuration from. */
export function usePinConfiguration(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (repository: string | null) => {
      await pinConfigurationRepository({
        path: { teamId: teamId as string },
        body: { repository },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: onboardingKeys.forTeam(teamId),
      });
      queryClient.invalidateQueries({
        queryKey: configurationKeys.forTeam(teamId),
      });
    },
  });
}
