import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replayKeys } from '@/hooks/api/useReplays';
import { stopReplay } from '@/lib/api';

type StopReplayInput = { teamId: string; replayId: string };

export function useStopReplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, replayId }: StopReplayInput) => {
      await stopReplay({ path: { teamId, replayId }, throwOnError: true });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: replayKeys.all }),
  });
}
