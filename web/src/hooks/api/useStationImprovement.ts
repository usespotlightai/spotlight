import { useQuery } from '@tanstack/react-query';
import { readStationImprovement } from '@/lib/api';
import { improving, type StationImprovement } from '@/lib/station-improvement';

const stationImprovementKeys = {
  forStation: (stationId?: string) =>
    ['station-improvement', stationId ?? null] as const,
};

const POLL_MS = 60_000;

const MOVING_POLL_MS = 10_000;

export function useStationImprovement(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  return useQuery({
    queryKey: stationImprovementKeys.forStation(stationId),
    enabled: Boolean(teamId && lineId && stationId),
    refetchInterval: (query) =>
      query.state.data && improving(query.state.data)
        ? MOVING_POLL_MS
        : POLL_MS,
    queryFn: async (): Promise<StationImprovement> => {
      const { data } = await readStationImprovement({
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
