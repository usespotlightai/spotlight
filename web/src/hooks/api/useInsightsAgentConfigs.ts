import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readInsightsAgentConfigs } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type {
  AgentConfigsNarrowed,
  InsightsAgentConfigs,
} from '@/lib/insights-changes';

const insightsAgentConfigsKeys = {
  forTeam: (
    teamId: string | undefined,
    period: InsightsPeriod,
    narrowed: AgentConfigsNarrowed,
  ) =>
    [
      'insights',
      'agent-configs',
      teamId ?? null,
      period,
      narrowed.stationId,
      narrowed.size,
    ] as const,
};

export function useInsightsAgentConfigs(
  teamId: string | undefined,
  period: InsightsPeriod,
  narrowed: AgentConfigsNarrowed,
) {
  return useQuery({
    queryKey: insightsAgentConfigsKeys.forTeam(teamId, period, narrowed),
    enabled: Boolean(teamId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<InsightsAgentConfigs> => {
      const { data } = await readInsightsAgentConfigs({
        path: { teamId: teamId as string },
        query: {
          period,
          ...(narrowed.stationId ? { stationId: narrowed.stationId } : {}),
          ...(narrowed.size ? { size: narrowed.size } : {}),
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
