import {
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';
import { stopRun } from '@/lib/api';
import type { TeamRun } from '@/lib/run';

type StopRunInput = { teamId: string; runId: string };

const stopRunKey = ['stop-run'] as const;

export function useStopRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: stopRunKey,
    mutationFn: async ({ teamId, runId }: StopRunInput) => {
      await stopRun({ path: { teamId, runId }, throwOnError: true });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useStopsAsked(): (run: TeamRun) => TeamRun {
  const asked = useMutationState({
    filters: {
      mutationKey: stopRunKey,
      predicate: (mutation) => mutation.state.status !== 'error',
    },
    select: (mutation) =>
      (mutation.state.variables as StopRunInput | undefined)?.runId,
  });

  return (run) =>
    asked.includes(run.id) &&
    (run.state === 'claimed' || run.state === 'queued')
      ? { ...run, state: 'cancelled' }
      : run;
}
