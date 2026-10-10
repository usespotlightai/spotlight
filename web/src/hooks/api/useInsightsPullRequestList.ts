import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listInsightsPullRequests } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type {
  InsightsPullRequestList,
  PullRequestAuthor,
  PullRequestFilter,
  PullRequestState,
  PullRequestType,
  RoundBucket,
} from '@/lib/insights-pull-requests';

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

export function useInsightsPullRequestList(
  teamId: string | undefined,
  period: InsightsPeriod,
  filter: PullRequestFilter,
  page: number,
) {
  return useQuery({
    queryKey: insightsPullRequestListKeys.forTeam(teamId, period, filter, page),
    enabled: Boolean(teamId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<InsightsPullRequestList> => {
      const { data } = await listInsightsPullRequests({
        path: { teamId: teamId as string },
        query: {
          period,
          page,
          repository: filter.repository,
          week: filter.week,
          author: filter.author as PullRequestAuthor | undefined,
          type: filter.type as PullRequestType | undefined,
          state: filter.state as PullRequestState | undefined,
          rounds: filter.rounds as RoundBucket | undefined,
          reverted: filter.reverted === 'true' ? true : undefined,
          compared: filter.compared === 'true' ? true : undefined,
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
