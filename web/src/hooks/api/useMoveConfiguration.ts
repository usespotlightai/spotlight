import { useMutation, useQueryClient } from '@tanstack/react-query';
import { configurationKeys } from '@/hooks/api/useConfiguration';
import { onboardingKeys } from '@/hooks/api/useOnboarding';
import { moveConfiguration } from '@/lib/api';

export function useMoveConfiguration(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (repository: string) => {
      const { data } = await moveConfiguration({
        path: { teamId: teamId as string },
        body: { repository },
        throwOnError: true,
      });
      return data;
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
