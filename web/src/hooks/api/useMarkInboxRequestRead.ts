import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { markInboxRequestRead } from '@/lib/api';

type MarkInboxRequestReadInput = {
  slug: string;
  requestId: string;
};

export function useMarkInboxRequestRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, requestId }: MarkInboxRequestReadInput) => {
      await markInboxRequestRead({
        path: { slug, requestId },
        throwOnError: true,
      });
    },

    onSuccess: (_read, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
