import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SharedQuery } from '@/hooks/api/sharedQuery';
import { readInsightsPeople } from '@/lib/api';
import type { InsightsPeople, InsightsPeriod } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

const insightsPeopleKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'people', teamId ?? null, period] as const,
};

export const insightsPeopleQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
): SharedQuery<InsightsPeople, ReturnType<typeof insightsPeopleKeys.forTeam>> =>
  queryOptions({
    queryKey: insightsPeopleKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsPeople> => {
      const { data } = await readInsightsPeople({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsPeople(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsPeople> {
  return useQuery({
    ...insightsPeopleQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
