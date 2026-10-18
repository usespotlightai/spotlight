import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runnerKeys } from '@/hooks/api/useRunners';
import { deleteHost } from '@/lib/api';

type DeleteHostsInput = {
  slug: string;
  hostIds: readonly string[];
};

export function useDeleteHosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, hostIds }: DeleteHostsInput) => {
      await Promise.all(
        hostIds.map((hostId) =>
          deleteHost({ path: { slug, hostId }, throwOnError: true }),
        ),
      );
    },
    onSettled: (_deleted, _error, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: runnerKeys.forWorkspace(slug),
      }),
  });
}
