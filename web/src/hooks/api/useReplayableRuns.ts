import { useQuery } from '@tanstack/react-query';
import { listReplayableRuns } from '@/lib/api';
import type { ReplayableRun } from '@/lib/replay';

export const replayableRunKeys = {
  forStation: (stationId?: string) =>
    ['replayable-runs', stationId ?? null] as const,
};

export function useReplayableRuns(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: replayableRunKeys.forStation(stationId),
    enabled: enabled && Boolean(teamId && lineId && stationId),
    queryFn: async (): Promise<ReplayableRun[]> => {
      const { data } = await listReplayableRuns({
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
