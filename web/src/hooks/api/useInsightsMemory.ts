import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { readInsightsMemory } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsMemory } from '@/lib/insights-memory';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

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
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsMemory(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsMemory> {
  return useQuery({
    ...insightsMemoryQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
