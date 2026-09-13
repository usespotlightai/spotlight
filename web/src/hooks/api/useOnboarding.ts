import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ChooseIntegrationsRequestDto,
  chooseIntegrations,
  readOnboarding,
} from '@/lib/api';

export const onboardingKeys = {
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

export function useChooseIntegrations(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (change: ChooseIntegrationsRequestDto) => {
      const { data } = await chooseIntegrations({
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
