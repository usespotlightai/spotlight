import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { readInboxItem } from '@/lib/api';

type ReadInboxItemInput = {
  slug: string;
  itemId: string;
};

export function useReadInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, itemId }: ReadInboxItemInput) => {
      await readInboxItem({ path: { slug, itemId }, throwOnError: true });
    },

    onSuccess: (_read, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
