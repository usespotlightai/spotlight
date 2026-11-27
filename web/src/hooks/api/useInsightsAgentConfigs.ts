import {
  keepPreviousData,
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { readInsightsAgentConfigs } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type {
  AgentConfigsNarrowed,
  InsightsAgentConfigs,
} from '@/lib/insights-changes';
import { required } from '@/lib/required';

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

const insightsAgentConfigsQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
  narrowed: AgentConfigsNarrowed,
) =>
  queryOptions({
    queryKey: insightsAgentConfigsKeys.forTeam(teamId, period, narrowed),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsAgentConfigs> => {
      const { data } = await readInsightsAgentConfigs({
        path: { teamId: required(teamId) },
        query: {
          period,
          ...(narrowed.stationId !== null && narrowed.stationId !== ''
            ? { stationId: narrowed.stationId }
            : {}),
          ...(narrowed.size !== null ? { size: narrowed.size } : {}),
        },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsAgentConfigs(
  teamId: string | undefined,
  period: InsightsPeriod,
  narrowed: AgentConfigsNarrowed,
): UseQueryResult<InsightsAgentConfigs> {
  return useQuery({
    ...insightsAgentConfigsQuery(teamId, period, narrowed),
    placeholderData: keepPreviousData,
  });
}
