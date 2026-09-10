import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chooseTools, readOnboarding } from '@/lib/api';

export const onboardingKeys = {
  forTeam: (teamId?: string) => ['onboarding', teamId ?? null] as const,
};

const POLL_MS = 10_000;

export function useOnboarding(teamId: string | undefined) {
  return useQuery({
    queryKey: onboardingKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    // Steps turn done out of band (a runner connects, the setup pull request
    // merges), so keep looking until they all are, then stop.
    refetchInterval: (query) =>
      query.state.data?.steps.every((step) => step.done) ? false : POLL_MS,
    queryFn: async () => {
      const { data } = await readOnboarding({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}

/**
 * Writes a starting file for each host newly chosen and takes away the file of
 * each let go, as one pull request to read.
 */
export function useChooseTools(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (change: { sources: string[]; dropped: string[] }) => {
      const { data } = await chooseTools({
        path: { teamId: teamId as string },
        body: change,
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
