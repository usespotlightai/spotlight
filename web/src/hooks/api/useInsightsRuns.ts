import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listInsightsRuns } from '@/lib/api';
import type {
  InsightsPeriod,
  InsightsRuns,
  RunDelivery,
  RunEnding,
  RunFilter,
  RunNext,
} from '@/lib/insights';

export const insightsRunKeys = {
  forTeam: (
    teamId: string | undefined,
    period: InsightsPeriod,
    filter: RunFilter,
    page: number,
  ) => ['insights', 'runs', teamId ?? null, period, filter, page] as const,
};

export function useInsightsRuns(
  teamId: string | undefined,
  period: InsightsPeriod,
  filter: RunFilter,
  page: number,
) {
  return useQuery({
    queryKey: insightsRunKeys.forTeam(teamId, period, filter, page),
    enabled: Boolean(teamId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<InsightsRuns> => {
      const { data } = await listInsightsRuns({
        path: { teamId: teamId as string },
        query: {
          period,
          page,
          ...filter,
          outcome: filter.outcome as RunEnding | undefined,
          delivery: filter.delivery as RunDelivery | undefined,
          next: filter.next as RunNext | undefined,
          asked: filter.asked === 'true' ? true : undefined,
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
