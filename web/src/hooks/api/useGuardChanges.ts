import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { guardChanges, unguardChanges } from '@/lib/api';

type GuardInput = { teamId: string; setId: string; guards: boolean };

export function useGuardChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, setId, guards }: GuardInput) => {
      const options = { path: { teamId, setId }, throwOnError: true } as const;

      await (guards ? guardChanges(options) : unguardChanges(options));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: replaySetKeys.all }),
  });
}
