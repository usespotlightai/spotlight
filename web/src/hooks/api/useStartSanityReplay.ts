import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { replayKeys } from '@/hooks/api/useReplays';
import {
  type SanityReplayStartedResponseDto,
  startSanityReplay,
} from '@/lib/api';
import type { Ceiling } from '@/lib/replay';

type StartSanityReplayInput = {
  teamId: string;
  setId: string;
  stronger: { model?: string; effort?: string };
  ceiling: Ceiling;
  repeats: number;
};

export function useStartSanityReplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      setId,
      stronger,
      ceiling,
      repeats,
    }: StartSanityReplayInput): Promise<SanityReplayStartedResponseDto> => {
      const { data } = await startSanityReplay({
        path: { teamId, setId },
        body: { ...stronger, ceiling, repeats },
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
