import { useQuery } from '@tanstack/react-query';
import { readStationInsights } from '@/lib/api';
import type { StationRunOutcomes } from '@/lib/station-insights';

const stationInsightsKeys = {
  forStation: (stationId?: string) =>
    ['station-insights', stationId ?? null] as const,
};

export function useStationInsights(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  return useQuery({
    queryKey: stationInsightsKeys.forStation(stationId),
    enabled: Boolean(teamId && lineId && stationId),
    queryFn: async (): Promise<StationRunOutcomes> => {
      const { data } = await readStationInsights({
        path: {
          teamId: teamId as string,
          lineId: lineId as string,
          stationId: stationId as string,
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
