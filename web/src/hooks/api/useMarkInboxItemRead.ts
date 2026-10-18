import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { markInboxItemRead } from '@/lib/api';

type MarkInboxItemReadInput = {
  slug: string;
  itemId: string;
};

export function useMarkInboxItemRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, itemId }: MarkInboxItemReadInput) => {
      await markInboxItemRead({ path: { slug, itemId }, throwOnError: true });
    },

    onSuccess: (_read, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
