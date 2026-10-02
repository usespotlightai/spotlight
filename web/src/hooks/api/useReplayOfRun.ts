import { useQuery } from '@tanstack/react-query';
import { replayRunKeys } from '@/hooks/api/useReplayRun';
import { readReplayOfRun } from '@/lib/api';
import type { ReplayOfRun } from '@/lib/replay';

export function useReplayOfRun(
  teamId: string | undefined,
  runId: string | undefined,
) {
  return useQuery({
    queryKey: replayRunKeys.replayOf(runId),
    enabled: Boolean(teamId && runId),
    queryFn: async (): Promise<ReplayOfRun> => {
      const { data } = await readReplayOfRun({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
