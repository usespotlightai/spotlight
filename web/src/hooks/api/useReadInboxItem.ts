import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { readInboxItem } from '@/lib/api';

type ReadInboxItemInput = {
  slug: string;
  itemId: string;
};

/** Opening what was put to you is what marks it seen. */
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
