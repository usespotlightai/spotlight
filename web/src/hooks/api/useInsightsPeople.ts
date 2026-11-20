import { queryOptions, useQuery } from '@tanstack/react-query';

import { readInsightsPeople } from '@/lib/api';
import type { InsightsPeople, InsightsPeriod } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';

const insightsPeopleKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'people', teamId ?? null, period] as const,
};

export const insightsPeopleQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsPeopleKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsPeople> => {
      const { data } = await readInsightsPeople({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsPeople(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsPeopleQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
