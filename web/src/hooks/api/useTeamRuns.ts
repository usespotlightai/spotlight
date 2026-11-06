import { useQuery } from '@tanstack/react-query';
import { usePagedList } from '@/hooks/api/usePagedList';
import { listTeamRuns, readTeamRun } from '@/lib/api';

export const teamRunKeys = {
  all: ['runs'] as const,
  forTeam: (teamId?: string) => ['runs', 'team', teamId ?? null] as const,
  one: (teamId?: string, runId?: string) =>
    ['runs', 'team', teamId ?? null, 'run', runId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTeamRuns(teamId: string | undefined) {
  return usePagedList({
    queryKey: teamRunKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    pollMs: POLL_MS,
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
  return useQuery({
    queryKey: teamRunKeys.one(teamId, runId),
    enabled: Boolean(teamId && runId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readTeamRun({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
