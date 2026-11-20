import { queryOptions, useQuery } from '@tanstack/react-query';

import { readInsightsOverview } from '@/lib/api';
import type { InsightsOverview, InsightsPeriod } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';

const insightsOverviewKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'overview', teamId ?? null, period] as const,
};

export const insightsOverviewQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
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

export function useInsightsOverview(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsOverviewQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
