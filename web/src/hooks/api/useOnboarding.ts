import { useQuery } from '@tanstack/react-query';
import { readOnboarding } from '@/lib/api';

const onboardingKeys = {
  forTeam: (teamId?: string) => ['onboarding', teamId ?? null] as const,
};

const POLL_MS = 10_000;

const CONNECTIONS_POLL_MS = 60_000;

export function useOnboarding(teamId: string | undefined) {
  return useQuery({
    queryKey: onboardingKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    refetchInterval: (query) => {
      const data = query.state.data;

      if (!data || data.steps.some((step) => !step.done)) {
        return POLL_MS;
      }

      return data.connections.some((each) => !each.firstOpenedAt)
        ? CONNECTIONS_POLL_MS
        : false;
    },
    queryFn: async () => {
      const { data } = await readOnboarding({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
