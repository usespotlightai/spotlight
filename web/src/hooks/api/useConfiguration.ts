import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readConfiguration, type ConfigurationResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

const configurationKeys = {
  forTeam: (teamId?: string) => ['configuration', teamId ?? null] as const,
};

export function useConfiguration(
  teamId: string | undefined,
): UseQueryResult<ConfigurationResponseDto> {
  return useQuery({
    queryKey: configurationKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await readConfiguration({
        path: { teamId: required(teamId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
