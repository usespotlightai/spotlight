import { useQuery } from '@tanstack/react-query';
import { readInsightsChanges } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsChanges } from '@/lib/insights-changes';

export const insightsChangesKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'changes', teamId ?? null, period] as const,
};

export function useInsightsChanges(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    queryKey: insightsChangesKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsChanges> => {
      const { data } = await readInsightsChanges({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });
}
