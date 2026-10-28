import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySet';
import { removeReplaySetEntry } from '@/lib/api';

type RemoveReplaySetEntryInput = {
  teamId: string;
  setId: string;
  runId: string;
};

export function useRemoveReplaySetEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, setId, runId }: RemoveReplaySetEntryInput) => {
      await removeReplaySetEntry({
        path: { teamId, setId, runId },
        throwOnError: true,
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: replaySetKeys.all }),
  });
}
