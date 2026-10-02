import { useQuery } from '@tanstack/react-query';
import { replayKeys } from '@/hooks/api/useReplays';
import { readReplay } from '@/lib/api';
import { type ReplayDetail, underway } from '@/lib/replay';

const POLL_MS = 10_000;

export function useReplay(
  teamId: string | undefined,
  replayId: string | undefined,
) {
  return useQuery({
    queryKey: replayKeys.detail(replayId),
    enabled: Boolean(teamId && replayId),
    refetchInterval: (query) =>
      query.state.data && underway(query.state.data.state) ? POLL_MS : false,
    queryFn: async (): Promise<ReplayDetail> => {
      const { data } = await readReplay({
        path: { teamId: teamId as string, replayId: replayId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
