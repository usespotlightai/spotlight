import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runnerKeys } from '@/hooks/api/useRunners';
import { enqueueRun, stopRun } from '@/lib/api';
import { AGENT_COMMAND } from '@/lib/runner';

type StartSessionInput = {
  slug: string;
  pool: string;
  runnerId: string;
};

export function useStartSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['runners', 'start-session'],
    mutationFn: async ({ slug, pool, runnerId }: StartSessionInput) => {
      const { data, error } = await enqueueRun({
        path: { slug },
        body: {
          pool,
          spec: { command: AGENT_COMMAND },
          targetRunnerId: runnerId,
        },
      });

      if (!data) {
        throw new Error(
          typeof error === 'object' && error && 'message' in error
            ? String(error.message)
            : 'Could not start a session',
        );
      }

      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: runnerKeys.all }),
  });
}

export function useStopSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['runs', 'stop'],
    mutationFn: async (runId: string) => {
      const { error } = await stopRun({ path: { runId } });

      if (error) {
        throw new Error('Could not stop the session');
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: runnerKeys.all }),
  });
}
