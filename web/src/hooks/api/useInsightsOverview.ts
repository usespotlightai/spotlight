import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SharedQuery } from '@/hooks/api/sharedQuery';
import { readInsightsOverview } from '@/lib/api';
import type { InsightsOverview, InsightsPeriod } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

const insightsOverviewKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'overview', teamId ?? null, period] as const,
};

export const insightsOverviewQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
): SharedQuery<
  InsightsOverview,
  ReturnType<typeof insightsOverviewKeys.forTeam>
> =>
  queryOptions({
    queryKey: insightsOverviewKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsOverview> => {
      const { data } = await readInsightsOverview({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsOverview(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsOverview> {
  return useQuery({
    ...insightsOverviewQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
