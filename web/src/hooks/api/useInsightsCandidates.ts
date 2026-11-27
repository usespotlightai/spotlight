import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { readReplayedCandidates } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsCandidates } from '@/lib/insights-candidates';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

const REPLAYING_POLL_MS = 30_000;

const insightsCandidatesKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'candidates', teamId ?? null, period] as const,
};

const insightsCandidatesQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsCandidatesKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsCandidates> => {
      const { data } = await readReplayedCandidates({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsCandidates(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsCandidates> {
  return useQuery({
    ...insightsCandidatesQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
    refetchInterval: (query) =>
      (query.state.data?.replaying.length ?? 0) > 0 ? REPLAYING_POLL_MS : false,
  });
}
