import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stopRun } from '@/lib/api';

type StopRunInput = { teamId: string; runId: string };

export function useStopRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, runId }: StopRunInput) => {
      await stopRun({ path: { teamId, runId }, throwOnError: true });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}
