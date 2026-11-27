import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SharedQuery } from '@/hooks/api/sharedQuery';
import { readInsightsFlow } from '@/lib/api';
import type { InsightsFlow, InsightsPeriod } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

const insightsFlowKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'flow', teamId ?? null, period] as const,
};

export const insightsFlowQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
): SharedQuery<InsightsFlow, ReturnType<typeof insightsFlowKeys.forTeam>> =>
  queryOptions({
    queryKey: insightsFlowKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsFlow> => {
      const { data } = await readInsightsFlow({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsFlow(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsFlow> {
  return useQuery({
    ...insightsFlowQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
