import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { addReplaySetEntry } from '@/lib/api';

type AddReplaySetEntryInput = { teamId: string; setId: string; runId: string };

export function useAddReplaySetEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, setId, runId }: AddReplaySetEntryInput) => {
      await addReplaySetEntry({
        path: { teamId, setId },
        body: { runId },
        throwOnError: true,
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: replaySetKeys.all }),
  });
}
