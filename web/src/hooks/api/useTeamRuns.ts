import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { type PagedList, usePagedList } from '@/hooks/api/usePagedList';
import { listTeamRuns, readTeamRun, type TeamRunResponseDto } from '@/lib/api';
import { liveStaleTime, useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';

export const teamRunKeys = {
  all: ['runs'] as const,
  forTeam: (teamId?: string) => ['runs', 'team', teamId ?? null] as const,
  one: (teamId?: string, runId?: string) =>
    ['runs', 'team', teamId ?? null, 'run', runId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTeamRuns(
  teamId: string | undefined,
): PagedList<TeamRunResponseDto> {
  const livePollMs = useLivePoll(POLL_MS);

  return usePagedList({
    queryKey: teamRunKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    pollMs: livePollMs,
    staleTime: liveStaleTime,
    keyOf: (run) => run.id,
    fetchPage: async (before?: string) => {
      const { data } = await listTeamRuns({
        path: { teamId: required(teamId) },
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
): UseQueryResult<TeamRunResponseDto> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: teamRunKeys.one(teamId, runId),
    enabled: Boolean(teamId) && Boolean(runId),
    refetchInterval: livePollMs,
    staleTime: liveStaleTime,
    queryFn: async () => {
      const { data } = await readTeamRun({
        path: { teamId: required(teamId), runId: required(runId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
