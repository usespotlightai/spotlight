import { queryOptions, useQuery } from '@tanstack/react-query';

import { readReplayedCandidates } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsCandidates } from '@/lib/insights-candidates';
import { keepTeamPeriod } from '@/lib/query';

const insightsCandidatesKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'candidates', teamId ?? null, period] as const,
};

export const insightsCandidatesQuery = (
  teamId: string | undefined,
  period: InsightsPeriod,
) =>
  queryOptions({
    queryKey: insightsCandidatesKeys.forTeam(teamId, period),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<InsightsCandidates> => {
      const { data } = await readReplayedCandidates({
        path: { teamId: teamId as string },
        query: { period },
        throwOnError: true,
      });
      return data;
    },
  });

export function useInsightsCandidates(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
    ...insightsCandidatesQuery(teamId, period),
    placeholderData: keepTeamPeriod(teamId),
  });
}
