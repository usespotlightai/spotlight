import { useQuery } from '@tanstack/react-query';
import { readInsightsStations } from '@/lib/api';
import type { InsightsPeriod, InsightsStations } from '@/lib/insights';

export const insightsStationsKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'stations', teamId ?? null, period] as const,
};

export function useInsightsStations(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
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
}
