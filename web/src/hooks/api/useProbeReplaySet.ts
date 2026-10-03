import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { replayKeys } from '@/hooks/api/useReplays';
import { probeReplaySet, type ReplayStartedResponseDto } from '@/lib/api';
import type { Ceiling } from '@/lib/replay';

type ProbeReplaySetInput = {
  teamId: string;
  setId: string;
  ceiling: Ceiling;
};

export function useProbeReplaySet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      setId,
      ceiling,
    }: ProbeReplaySetInput): Promise<ReplayStartedResponseDto> => {
      const { data } = await probeReplaySet({
        path: { teamId, setId },
        body: { ceiling },
        throwOnError: true,
      });
      return data;
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: replayKeys.all }),
        queryClient.invalidateQueries({ queryKey: replaySetKeys.all }),
      ]),
  });
}
