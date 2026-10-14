import { useQuery } from '@tanstack/react-query';
import { readInsightsFlow } from '@/lib/api';
import type { InsightsFlow, InsightsPeriod } from '@/lib/insights';

const insightsFlowKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'flow', teamId ?? null, period] as const,
};

export function useInsightsFlow(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    queryKey: insightsFlowKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsFlow> => {
      const { data } = await readInsightsFlow({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });
}
