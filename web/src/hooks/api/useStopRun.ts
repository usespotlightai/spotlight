import {
  type Mutation,
  useMutation,
  useMutationState,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { stopRun } from '@/lib/api';

type StopRunInput = { teamId: string; runId: string };

const stopRunKey = ['stop-run'] as const;

export function useStopRun(): UseMutationResult<void, Error, StopRunInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: stopRunKey,
    mutationFn: async ({ teamId, runId }: StopRunInput) => {
      await stopRun({ path: { teamId, runId }, throwOnError: true });
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['runs'] }),
        queryClient.invalidateQueries({ queryKey: runNotesKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['inbox'] }),
      ]),
  });
}

export function useStopInFlight(runId: string | null | undefined): boolean {
  return useMutationState({
    filters: { mutationKey: stopRunKey, status: 'pending' },
    select: (mutation: Mutation<void, Error, StopRunInput>) =>
      mutation.state.variables?.runId,
  }).some((stopping) => stopping === runId);
}
