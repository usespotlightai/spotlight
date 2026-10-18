import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { gateChanges, ungateChanges } from '@/lib/api';

type GateInput = { teamId: string; setId: string; gates: boolean };

export function useGateChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, setId, gates }: GateInput) => {
      const options = { path: { teamId, setId }, throwOnError: true } as const;

      await (gates ? gateChanges(options) : ungateChanges(options));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: replaySetKeys.all }),
  });
}
