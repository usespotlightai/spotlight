import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { createReplaySet } from '@/lib/api';

type CreateReplaySetInput = {
  teamId: string;
  lineId: string;
  stationId: string;
  name: string;
};

export function useCreateReplaySet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      lineId,
      stationId,
      name,
    }: CreateReplaySetInput): Promise<string> => {
      const { data } = await createReplaySet({
        path: { teamId, lineId, stationId },
        body: { name },
        throwOnError: true,
      });
      return data.id;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: replaySetKeys.all }),
  });
}
