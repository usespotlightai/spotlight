import { useQuery } from '@tanstack/react-query';
import { readReplayRun } from '@/lib/api';
import type { ReplayRun } from '@/lib/replay';
import { underway } from '@/lib/run';

export const replayRunKeys = {
  forRun: (runId?: string) => ['replay-run', runId ?? null] as const,
  replayOf: (runId?: string) =>
    ['replay-run', 'replay', runId ?? null] as const,
};

const POLL_MS = 5_000;

export function useReplayRun(
  teamId: string | undefined,
  runId: string | undefined,
) {
  return useQuery({
    queryKey: replayRunKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data && underway(query.state.data) ? POLL_MS : false,
    queryFn: async (): Promise<ReplayRun> => {
      const { data } = await readReplayRun({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
