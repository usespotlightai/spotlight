import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { replayKeys } from '@/hooks/api/useReplays';
import { deleteReplaySet } from '@/lib/api';

type DeleteReplaySetInput = { teamId: string; setId: string };

export function useDeleteReplaySet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, setId }: DeleteReplaySetInput) => {
      await deleteReplaySet({ path: { teamId, setId }, throwOnError: true });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: replaySetKeys.all });
      void queryClient.invalidateQueries({ queryKey: replayKeys.all });
    },
  });
}
