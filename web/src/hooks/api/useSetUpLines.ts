import { useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingKeys } from '@/hooks/api/useOnboarding';
import { setUpLines } from '@/lib/api';
import type { SetUpLineRequestDto } from '@/lib/api/types.gen';

/**
 * Assigns each line its harness and repositories, then opens the pull request
 * that sets the team up. Nothing is written until this is asked for.
 */
export function useSetUpLines(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lines: SetUpLineRequestDto[]) => {
      const { data } = await setUpLines({
        path: { teamId: teamId as string },
        body: { lines },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: onboardingKeys.forTeam(teamId),
      });
    },
  });
}
