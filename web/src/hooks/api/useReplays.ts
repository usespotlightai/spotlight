import { useQuery } from '@tanstack/react-query';
import { listReplays } from '@/lib/api';
import { anyInProgress, type Replay } from '@/lib/replay';

export const replayKeys = {
  all: ['replays'] as const,
  forSet: (setId?: string) => ['replays', 'set', setId ?? null] as const,
  detail: (replayId?: string) =>
    ['replays', 'detail', replayId ?? null] as const,
};

const POLL_MS = 10_000;

export function useReplays(
  teamId: string | undefined,
  setId: string | undefined,
) {
  return useQuery({
    queryKey: replayKeys.forSet(setId),
    enabled: Boolean(teamId && setId),
    refetchInterval: (query) =>
      query.state.data && anyInProgress(query.state.data) ? POLL_MS : false,
    queryFn: async (): Promise<Replay[]> => {
      const { data } = await listReplays({
        path: { teamId: teamId as string, setId: setId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
