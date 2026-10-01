import { useQuery } from '@tanstack/react-query';
import { readInsightsTools } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsTools } from '@/lib/insights-tools';

export const insightsToolsKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'tools', teamId ?? null, period] as const,
};

export function useInsightsTools(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    queryKey: insightsToolsKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsTools> => {
      const { data } = await readInsightsTools({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });
}
