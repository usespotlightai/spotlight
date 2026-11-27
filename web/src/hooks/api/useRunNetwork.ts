import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readRunNetwork, type RunNetworkResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

const runNetworkKeys = {
  forRun: (runId?: string) => ['run-network', runId ?? null] as const,
};

export function useRunNetwork(
  teamId: string | undefined,
  runId: string | undefined,
): UseQueryResult<RunNetworkResponseDto> {
  return useQuery({
    queryKey: runNetworkKeys.forRun(runId),
    enabled: Boolean(teamId) && Boolean(runId),
    queryFn: async () => {
      const { data } = await readRunNetwork({
        path: { teamId: required(teamId), runId: required(runId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
