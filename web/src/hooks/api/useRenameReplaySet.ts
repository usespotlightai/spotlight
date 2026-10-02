import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { renameReplaySet } from '@/lib/api';

type RenameReplaySetInput = { teamId: string; setId: string; name: string };

export function useRenameReplaySet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, setId, name }: RenameReplaySetInput) => {
      await renameReplaySet({
        path: { teamId, setId },
        body: { name },
        throwOnError: true,
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: replaySetKeys.all }),
  });
}
