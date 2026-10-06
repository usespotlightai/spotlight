import { useQuery } from '@tanstack/react-query';
import { listTeamRuns } from '@/lib/api';

export const teamRunKeys = {
  all: ['runs'] as const,
  forTeam: (teamId?: string) => ['runs', 'team', teamId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTeamRuns(teamId: string | undefined) {
  return useQuery({
    queryKey: teamRunKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await listTeamRuns({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
