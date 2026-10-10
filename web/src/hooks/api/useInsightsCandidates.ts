import { useQuery } from '@tanstack/react-query';
import { readReplayedCandidates } from '@/lib/api';
import type { InsightsPeriod } from '@/lib/insights';
import type { InsightsCandidates } from '@/lib/insights-candidates';

const insightsCandidatesKeys = {
  forTeam: (teamId: string | undefined, period: InsightsPeriod) =>
    ['insights', 'candidates', teamId ?? null, period] as const,
};

export function useInsightsCandidates(
  teamId: string | undefined,
  period: InsightsPeriod,
) {
  return useQuery({
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
}
