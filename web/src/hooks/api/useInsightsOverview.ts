import { useQuery } from '@tanstack/react-query';
import { readInsightsOverview } from '@/lib/api';
import type { InsightsOverview, InsightsPeriod } from '@/lib/insights';

const insightsOverviewKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'overview', teamId ?? null, period] as const,
};

export function useInsightsOverview(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    queryKey: insightsOverviewKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsOverview> => {
      const { data } = await readInsightsOverview({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });
}
