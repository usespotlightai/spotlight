import { useQuery } from '@tanstack/react-query';
import { readOnboarding } from '@/lib/api';

const onboardingKeys = {
  forTeam: (teamId?: string) => ['onboarding', teamId ?? null] as const,
};

const POLL_MS = 10_000;

export function useOnboarding(teamId: string | undefined) {
  return useQuery({
    queryKey: onboardingKeys.forTeam(teamId),
    enabled: Boolean(teamId),
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
