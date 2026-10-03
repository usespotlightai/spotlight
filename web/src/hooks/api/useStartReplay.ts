import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replayKeys } from '@/hooks/api/useReplays';
import { type ReplayStartedResponseDto, startReplay } from '@/lib/api';
import type { Ceiling } from '@/lib/replay';

type StartReplayInput = {
  teamId: string;
  setId: string;
  candidate: string;
  ceiling: Ceiling;
  repeats: number;
};

export function useStartReplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      setId,
      candidate,
      ceiling,
      repeats,
    }: StartReplayInput): Promise<ReplayStartedResponseDto> => {
      const { data } = await startReplay({
        path: { teamId, setId },
        body: { candidate, ceiling, repeats },
        throwOnError: true,
      });
      return data;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: replayKeys.all }),
  });
}
