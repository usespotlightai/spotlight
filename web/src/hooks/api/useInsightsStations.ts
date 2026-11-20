import { queryOptions, useQuery } from '@tanstack/react-query';

import { readInsightsStations } from '@/lib/api';
import type { InsightsPeriod, InsightsStations } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';

export const insightsStationsKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'stations', teamId ?? null, period] as const,
};

export const insightsStationsQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsStationsKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsStations> => {
      const { data } = await readInsightsStations({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsStations(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsStationsQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
