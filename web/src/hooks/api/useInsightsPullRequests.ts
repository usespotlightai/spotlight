import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { readInsightsPullRequests } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsPullRequests } from '@/lib/insights-pull-requests';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

const insightsPullRequestsKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'pull-requests', teamId ?? null, period] as const,
};

const insightsPullRequestsQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsPullRequestsKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsPullRequests> => {
      const { data } = await readInsightsPullRequests({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsPullRequests(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsPullRequests> {
  return useQuery({
    ...insightsPullRequestsQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
