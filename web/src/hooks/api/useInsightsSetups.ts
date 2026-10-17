import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readInsightsSetups } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsSetups, SetupsNarrowed } from '@/lib/insights-changes';

const insightsSetupsKeys = {
  forTeam: (
    teamId: string | undefined,
    period: InsightsPeriod,
    narrowed: SetupsNarrowed,
  ) =>
    [
      'insights',
      'setups',
      teamId ?? null,
      period,
      narrowed.stationId,
      narrowed.size,
    ] as const,
};

export function useInsightsSetups(
  teamId: string | undefined,
  period: InsightsPeriod,
  narrowed: SetupsNarrowed,
) {
  return useQuery({
    queryKey: insightsSetupsKeys.forTeam(teamId, period, narrowed),
    enabled: Boolean(teamId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<InsightsSetups> => {
      const { data } = await readInsightsSetups({
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
