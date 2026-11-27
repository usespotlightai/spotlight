import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SharedQuery } from '@/hooks/api/sharedQuery';
import { readInsightsTools } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsTools } from '@/lib/insights-tools';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

const insightsToolsKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'tools', teamId ?? null, period] as const,
};

export const insightsToolsQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
): SharedQuery<InsightsTools, ReturnType<typeof insightsToolsKeys.forTeam>> =>
  queryOptions({
    queryKey: insightsToolsKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsTools> => {
      const { data } = await readInsightsTools({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsTools(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsTools> {
  return useQuery({
    ...insightsToolsQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
