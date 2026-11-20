import { queryOptions, useQuery } from '@tanstack/react-query';

import {
  type InsightsShippingResponseDto,
  readInsightsShipping,
} from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import { keepTeamPeriod } from '@/lib/query';

const insightsShippingKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'shipping', teamId ?? null, period] as const,
};

export const insightsShippingQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
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

export function useInsightsShipping(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsShippingQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
