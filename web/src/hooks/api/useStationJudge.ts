import { useQuery } from '@tanstack/react-query';
import { readStationJudge } from '@/lib/api';
import type { StationJudgeAgreement } from '@/lib/judge';

export const stationJudgeKeys = {
  forStation: (stationId?: string) =>
    ['station-judge', stationId ?? null] as const,
};

export function useStationJudge(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  return useQuery({
    queryKey: stationJudgeKeys.forStation(stationId),
    enabled: Boolean(teamId && lineId && stationId),
    queryFn: async (): Promise<StationJudgeAgreement> => {
      const { data } = await readStationJudge({
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
