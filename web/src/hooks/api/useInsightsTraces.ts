import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listInsightsTraces } from '@/lib/api';
import type {
  InsightsTraces,
  RunEnding,
  RunFilter,
  RunHumanAction,
  RunPullRequestState,
} from '@/lib/insights';
import { rangeOf } from '@/lib/range';

const insightsTraceKeys = {
  forTeam: (teamId: string | undefined, range: string, filter: RunFilter) =>
    ['insights', 'traces', teamId ?? null, range, filter] as const,
};

const POLL_MS = 10_000;

export function useInsightsTraces(
  teamId: string | undefined,
  range: string,
  filter: RunFilter,
) {
  return useQuery({
    queryKey: insightsTraceKeys.forTeam(teamId, range, filter),
    enabled: Boolean(teamId),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<InsightsTraces> => {
      const { data } = await listInsightsTraces({
        path: { teamId: teamId as string },
        query: {
          range: rangeOf(range).id,
          ...filter,
          outcome: filter.outcome as RunEnding | undefined,
          pullRequestState: filter.pullRequestState as
            | RunPullRequestState
            | undefined,
          humanAction: filter.humanAction as RunHumanAction | undefined,
          asked: filter.asked === 'true' ? true : undefined,
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
