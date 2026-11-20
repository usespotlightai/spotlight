import { queryOptions, useQuery } from '@tanstack/react-query';

import { readInsightsMemory } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsMemory } from '@/lib/insights-memory';
import { keepTeamPeriod } from '@/lib/query';

const insightsMemoryKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'memory', teamId ?? null, period] as const,
};

const insightsMemoryQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsMemoryKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsMemory> => {
      const { data } = await readInsightsMemory({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsMemory(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsMemoryQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
