import {
  keepPreviousData,
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { listInsightsPullRequests } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import {
  type InsightsPullRequestList,
  PULL_REQUEST_AUTHORS,
  PULL_REQUEST_STATES,
  PULL_REQUEST_TYPES,
  ROUND_BUCKETS,
  type PullRequestFilter,
} from '@/lib/insights-pull-requests';
import { oneOf } from '@/lib/one-of';
import { required } from '@/lib/required';

const insightsPullRequestListKeys = {
  forTeam: (
    teamId: string | undefined,
    period: InsightsPeriod,
    filter: PullRequestFilter,
    page: number,
  ) =>
    [
      'insights',
      'pull-request-list',
      teamId ?? null,
      period,
      filter,
      page,
    ] as const,
};

const insightsPullRequestListQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
  filter: PullRequestFilter,
  page: number,
) =>
  queryOptions({
    queryKey: insightsPullRequestListKeys.forTeam(teamId, period, filter, page),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsPullRequestList> => {
      const { data } = await listInsightsPullRequests({
        path: { teamId: required(teamId) },
        query: {
          period,
          page,
          repository: filter.repository,
          week: filter.week,
          author: oneOf(PULL_REQUEST_AUTHORS, filter.author),
          type: oneOf(PULL_REQUEST_TYPES, filter.type),
          state: oneOf(PULL_REQUEST_STATES, filter.state),
          rounds: oneOf(ROUND_BUCKETS, filter.rounds),
          reverted: filter.reverted === 'true' ? true : undefined,
          compared: filter.compared === 'true' ? true : undefined,
        },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsPullRequestList(
  teamId: string | undefined,
  period: InsightsPeriod,
  filter: PullRequestFilter,
  page: number,
): UseQueryResult<InsightsPullRequestList> {
  return useQuery({
    ...insightsPullRequestListQuery(teamId, period, filter, page),
    placeholderData: keepPreviousData,
  });
}
