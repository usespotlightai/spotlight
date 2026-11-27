import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SharedQuery } from '@/hooks/api/sharedQuery';
import { readInsightsStations } from '@/lib/api';
import type { InsightsPeriod, InsightsStations } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

export const insightsStationsKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'stations', teamId ?? null, period] as const,
};

export const insightsStationsQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
): SharedQuery<
  InsightsStations,
  ReturnType<typeof insightsStationsKeys.forTeam>
> =>
  queryOptions({
    queryKey: insightsStationsKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsStations> => {
      const { data } = await readInsightsStations({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsStations(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsStations> {
  return useQuery({
    ...insightsStationsQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
