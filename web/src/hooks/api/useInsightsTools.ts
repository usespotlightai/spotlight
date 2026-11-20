import { queryOptions, useQuery } from '@tanstack/react-query';

import { readInsightsTools } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsTools } from '@/lib/insights-tools';
import { keepTeamPeriod } from '@/lib/query';

const insightsToolsKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'tools', teamId ?? null, period] as const,
};

export const insightsToolsQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsToolsKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsTools> => {
      const { data } = await readInsightsTools({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsTools(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsToolsQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
