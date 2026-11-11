import { useQuery } from '@tanstack/react-query';

import { usePagedList } from '@/hooks/api/usePagedList';
import { listTeamRuns, readTeamRun } from '@/lib/api';
import { useLivePoll } from '@/lib/live';

export const teamRunKeys = {
  all: ['runs'] as const,
  forTeam: (teamId?: string) => ['runs', 'team', teamId ?? null] as const,
  one: (teamId?: string, runId?: string) =>
    ['runs', 'team', teamId ?? null, 'run', runId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTeamRuns(teamId: string | undefined) {
  const livePollMs = useLivePoll(POLL_MS);

  return usePagedList({
    queryKey: teamRunKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    pollMs: livePollMs,
    keyOf: (run) => run.id,
    fetchPage: async (before?: string) => {
      const { data } = await listTeamRuns({
        path: { teamId: teamId as string },
        query: { before },
        throwOnError: true,
      });
      return data;
    },
  });
}

export function useTeamRun(
  teamId: string | undefined,
  runId: string | undefined,
) {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: teamRunKeys.one(teamId, runId),
    enabled: Boolean(teamId && runId),
    refetchInterval: livePollMs,
    queryFn: async () => {
      const { data } = await readTeamRun({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
