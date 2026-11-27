import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readStationJudge } from '@/lib/api';
import type { StationJudgeAgreement } from '@/lib/judge';
import { required } from '@/lib/required';

export const stationJudgeKeys = {
  forStation: (stationId?: string) =>
    ['station-judge', stationId ?? null] as const,
};

export function useStationJudge(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
): UseQueryResult<StationJudgeAgreement> {
  return useQuery({
    queryKey: stationJudgeKeys.forStation(stationId),
    enabled: Boolean(teamId) && Boolean(lineId) && Boolean(stationId),
    queryFn: async (): Promise<StationJudgeAgreement> => {
      const { data } = await readStationJudge({
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
