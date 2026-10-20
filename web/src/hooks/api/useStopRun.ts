import {
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { stopRun } from '@/lib/api';

type StopRunInput = { teamId: string; runId: string };

const stopRunKey = ['stop-run'] as const;

export function useStopRun() {
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

export function useStopInFlight(runId: string | undefined): boolean {
  return (
    useMutationState({
      filters: {
        mutationKey: stopRunKey,
        status: 'pending',
        predicate: (mutation) =>
          (mutation.state.variables as StopRunInput | undefined)?.runId ===
          runId,
      },
    }).length > 0
  );
}
