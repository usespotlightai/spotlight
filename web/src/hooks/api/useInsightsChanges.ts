import { queryOptions, useQuery } from '@tanstack/react-query';

import { readInsightsChanges } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsChanges } from '@/lib/insights-changes';
import { keepTeamPeriod } from '@/lib/query';

const insightsChangesKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'changes', teamId ?? null, period] as const,
};

const insightsChangesQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsChangesKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsChanges> => {
      const { data } = await readInsightsChanges({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsChanges(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsChangesQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
