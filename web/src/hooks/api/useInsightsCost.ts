import { queryOptions, useQuery } from '@tanstack/react-query';

import { readInsightsCost } from '@/lib/api';
import type { InsightsCost, InsightsPeriod } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';

const insightsCostKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'cost', teamId ?? null, period] as const,
};

export const insightsCostQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsCostKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsCost> => {
      const { data } = await readInsightsCost({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsCost(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsCostQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
