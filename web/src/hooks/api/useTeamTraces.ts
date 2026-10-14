import { useQuery } from '@tanstack/react-query';
import { listTeamTraces } from '@/lib/api';
import { rangeOf } from '@/lib/range';

const teamTraceKeys = {
  forTeam: (teamId?: string, range?: string) =>
    ['traces', 'team', teamId ?? null, range ?? null] as const,
};

const POLL_MS = 10_000;

export function useTeamTraces(teamId: string | undefined, range: string) {
  return useQuery({
    queryKey: teamTraceKeys.forTeam(teamId, range),
    enabled: Boolean(teamId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await listTeamTraces({
        path: { teamId: teamId as string },
        query: { range: rangeOf(range).id },
        throwOnError: true,
      });
      return data;
    },
  });
}
