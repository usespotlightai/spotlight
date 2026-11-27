import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readStationImprovement } from '@/lib/api';
import { liveStaleTime, useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';
import type { StationImprovement } from '@/lib/station-improvement';

const POLL_MS = 30_000;

const stationImprovementKeys = {
  of: (teamId?: string, lineId?: string, stationId?: string) =>
    [
      'stations',
      'improvement',
      teamId ?? null,
      lineId ?? null,
      stationId ?? null,
    ] as const,
};

export function useStationImprovement(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
): UseQueryResult<StationImprovement> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: stationImprovementKeys.of(teamId, lineId, stationId),
    enabled: Boolean(teamId) && Boolean(lineId) && Boolean(stationId),
    refetchInterval: livePollMs,
    staleTime: liveStaleTime,
    queryFn: async () => {
      const { data } = await readStationImprovement({
        path: {
          teamId: required(teamId),
          lineId: required(lineId),
          stationId: required(stationId),
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
