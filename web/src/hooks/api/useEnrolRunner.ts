import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runnerKeys } from '@/hooks/api/useRunners';
import { enrolRunner, revokeRunner } from '@/lib/api';

export function useEnrolRunner(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runner: { name: string }) => {
      const { data } = await enrolRunner({
        path: { slug },
        body: runner,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: runnerKeys.forWorkspace(slug),
      }),
  });
}

export function useRevokeRunner(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runnerId: string) => {
      await revokeRunner({ path: { slug, runnerId }, throwOnError: true });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: runnerKeys.forWorkspace(slug),
      }),
  });
}
