import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runnerKeys } from '@/hooks/api/useRunners';
import { enrolRunner, revokeRunner } from '@/lib/api';

export function useEnrolRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runner: { name: string }) => {
      const { data } = await enrolRunner({
        body: runner,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: runnerKeys.all }),
  });
}

export function useRevokeRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string) => {
      await revokeRunner({ path: { runnerId }, throwOnError: true });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: runnerKeys.all }),
  });
}
