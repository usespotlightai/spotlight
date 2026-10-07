import { useQuery } from '@tanstack/react-query';
import {
  type InsightsShippingResponseDto,
  readInsightsShipping,
} from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';

export const insightsShippingKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'shipping', teamId ?? null, period] as const,
};

export function useInsightsShipping(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    queryKey: insightsShippingKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsShippingResponseDto> => {
      const { data } = await readInsightsShipping({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });
}
