import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  listIntegrationConnections,
  type IntegrationConnectionsResponseDto,
} from '@/lib/api';
import { required } from '@/lib/required';

export const connectionKeys = {
  forTeam: (teamId?: string) => ['connections', teamId ?? null] as const,
};

export function useIntegrationConnections(
  teamId: string | undefined,
): UseQueryResult<IntegrationConnectionsResponseDto> {
  return useQuery({
    queryKey: connectionKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listIntegrationConnections({
        path: { teamId: required(teamId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
