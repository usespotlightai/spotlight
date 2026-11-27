import {
  keepPreviousData,
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SharedQuery } from '@/hooks/api/sharedQuery';
import { listInsightsTraces } from '@/lib/api';
import {
  type InsightsTraces,
  RUN_ENDINGS,
  RUN_HUMAN_ACTIONS,
  RUN_PULL_REQUEST_STATES,
  RUN_RESOLUTIONS,
  type RunFilter,
} from '@/lib/insights';
import { oneOf } from '@/lib/one-of';
import { rangeOf } from '@/lib/range';
import { required } from '@/lib/required';

const insightsTraceKeys = {
  forTeam: (teamId: string | undefined, range: string, filter: RunFilter) =>
    ['insights', 'traces', teamId ?? null, range, filter] as const,
};

const POLL_MS = 10_000;

export const insightsTracesQuery = (
  teamId: string | undefined,
  range: string,
  filter: RunFilter,
): SharedQuery<InsightsTraces, ReturnType<typeof insightsTraceKeys.forTeam>> =>
  queryOptions({
    queryKey: insightsTraceKeys.forTeam(teamId, range, filter),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsTraces> => {
      const { data } = await listInsightsTraces({
        path: { teamId: required(teamId) },
        query: {
          range: rangeOf(range).id,
          ...filter,
          outcome: oneOf(RUN_ENDINGS, filter.outcome),
          pullRequestState: oneOf(
            RUN_PULL_REQUEST_STATES,
            filter.pullRequestState,
          ),
          humanAction: oneOf(RUN_HUMAN_ACTIONS, filter.humanAction),
          resolution: oneOf(RUN_RESOLUTIONS, filter.resolution),
          asked: filter.asked === 'true' ? true : undefined,
        },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsTraces(
  teamId: string | undefined,
  range: string,
  filter: RunFilter,
): UseQueryResult<InsightsTraces> {
  return useQuery({
    ...insightsTracesQuery(teamId, range, filter),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
  });
}
