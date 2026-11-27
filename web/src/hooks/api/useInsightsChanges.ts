import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { readInsightsChanges } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsChanges } from '@/lib/insights-changes';
import { keepTeamPeriod } from '@/lib/query';
import { required } from '@/lib/required';

const insightsChangesKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'changes', teamId ?? null, period] as const,
};

const insightsChangesQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsChangesKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsChanges> => {
      const { data } = await readInsightsChanges({
        path: { teamId: required(teamId) },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsChanges(
  teamId: string | undefined,
  period: InsightsPeriod,
): UseQueryResult<InsightsChanges> {
  return useQuery({
    ...insightsChangesQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
