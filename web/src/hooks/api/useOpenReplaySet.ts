import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { openReplaySet } from '@/lib/api';

type OpenReplaySetInput = {
  teamId: string;
  lineId: string;
  stationId: string;
  name: string;
};

export function useOpenReplaySet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      lineId,
      stationId,
      name,
    }: OpenReplaySetInput): Promise<string> => {
      const { data } = await openReplaySet({
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
