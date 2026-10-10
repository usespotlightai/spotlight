import { useQuery } from '@tanstack/react-query';
import { listStationOutcomes } from '@/lib/api';
import type { StationOutcomes } from '@/lib/station-outcomes';

const stationOutcomeKeys = {
  forStation: (stationId?: string) =>
    ['station-outcomes', stationId ?? null] as const,
};

export function useStationOutcomes(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  return useQuery({
    queryKey: stationOutcomeKeys.forStation(stationId),
    enabled: Boolean(teamId && lineId && stationId),
    queryFn: async (): Promise<StationOutcomes> => {
      const { data } = await listStationOutcomes({
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
