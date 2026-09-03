import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chooseTools, readOnboarding } from '@/lib/api';

export const onboardingKeys = {
  forTeam: (teamId?: string) => ['onboarding', teamId ?? null] as const,
};

export function useOnboarding(teamId: string | undefined) {
  return useQuery({
    queryKey: onboardingKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await readOnboarding({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}

/** Writes a starting file for each host chosen, as a pull request to read. */
export function useChooseTools(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sources: string[]) => {
      const { data } = await chooseTools({
        path: { teamId: teamId as string },
        body: { sources },
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
