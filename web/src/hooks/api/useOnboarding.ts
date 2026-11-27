import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { type OnboardingResponseDto, readOnboarding } from '@/lib/api';
import { required } from '@/lib/required';
import { setupStatusPollFor } from '@/lib/setup-status';

const onboardingKeys = {
  forTeam: (teamId?: string) => ['onboarding', teamId ?? null] as const,
};

const POLL_MS = 10_000;

const provisioningPoll = (onboarding: OnboardingResponseDto | undefined) =>
  setupStatusPollFor(onboarding?.provisioning);

const onboardingQuery = (teamId: string | undefined) =>
  queryOptions({
    queryKey: onboardingKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    refetchInterval: (query) => {
      const onboarding = query.state.data;

      const provisioning = provisioningPoll(onboarding);

      if (provisioning !== false && provisioning !== 0) {
        return provisioning;
      }

      return onboarding?.steps.every((step) => step.done) === true
        ? false
        : POLL_MS;
    },
    queryFn: async () => {
      const { data } = await readOnboarding({
        path: { teamId: required(teamId) },
        throwOnError: true,
      });
      return data;
    },
  });

type OnboardingQuery = ReturnType<typeof onboardingQuery>;

export const provisioningQuery = (teamId: string): OnboardingQuery =>
  queryOptions({
    ...onboardingQuery(teamId),
    refetchInterval: (query) => provisioningPoll(query.state.data),
  });

export function useOnboarding(
  teamId: string | undefined,
): UseQueryResult<OnboardingResponseDto> {
  return useQuery(onboardingQuery(teamId));
}
