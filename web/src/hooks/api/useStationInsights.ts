import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readStationInsights } from '@/lib/api';
import { required } from '@/lib/required';
import type { StationRunOutcomes } from '@/lib/station-insights';

export const stationInsightsKeys = {
  forStation: (stationId?: string) =>
    ['station-insights', stationId ?? null] as const,
};

export function useStationInsights(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
): UseQueryResult<StationRunOutcomes> {
  return useQuery({
    queryKey: stationInsightsKeys.forStation(stationId),
    enabled: Boolean(teamId) && Boolean(lineId) && Boolean(stationId),
    queryFn: async (): Promise<StationRunOutcomes> => {
      const { data } = await readStationInsights({
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
