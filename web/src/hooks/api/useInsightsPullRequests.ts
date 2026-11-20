import { queryOptions, useQuery } from '@tanstack/react-query';

import { readInsightsPullRequests } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsPullRequests } from '@/lib/insights-pull-requests';
import { keepTeamPeriod } from '@/lib/query';

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
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsPullRequests(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsPullRequestsQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
