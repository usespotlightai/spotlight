import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SharedQuery } from '@/hooks/api/sharedQuery';
import { readInsightsCost } from '@/lib/api';
import type { InsightsCost, InsightsPeriod } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

const insightsCostKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'cost', teamId ?? null, period] as const,
};

export const insightsCostQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
): SharedQuery<InsightsCost, ReturnType<typeof insightsCostKeys.forTeam>> =>
  queryOptions({
    queryKey: insightsCostKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsCost> => {
      const { data } = await readInsightsCost({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsCost(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsCost> {
  return useQuery({
    ...insightsCostQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
