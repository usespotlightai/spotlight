import { queryOptions, useQuery } from '@tanstack/react-query';
import { type OnboardingResponseDto, readOnboarding } from '@/lib/api';
import { provisioningPollFor } from '@/lib/provisioning';

const onboardingKeys = {
  forTeam: (teamId?: string) => ['onboarding', teamId ?? null] as const,
};

const POLL_MS = 10_000;

const provisioningPoll = (onboarding: OnboardingResponseDto | undefined) =>
  provisioningPollFor(onboarding?.provisioning);

const onboardingQuery = (teamId: string | undefined) =>
  queryOptions({
    queryKey: onboardingKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    refetchInterval: (query) => {
      const onboarding = query.state.data;

      return (
        provisioningPoll(onboarding) ||
        (onboarding?.steps.every((step) => step.done) ? false : POLL_MS)
      );
    },
    queryFn: async () => {
      const { data } = await readOnboarding({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });

export const provisioningQuery = (teamId: string) =>
  queryOptions({
    ...onboardingQuery(teamId),
    refetchInterval: (query) => provisioningPoll(query.state.data),
  });

export function useOnboarding(teamId: string | undefined) {
  return useQuery(onboardingQuery(teamId));
}
