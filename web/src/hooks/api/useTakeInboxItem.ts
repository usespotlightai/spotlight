import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { takeInboxItem } from '@/lib/api';

type TakeInboxItemInput = {
  slug: string;
  itemId: string;
};

export function useTakeInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, itemId }: TakeInboxItemInput) => {
      await takeInboxItem({ path: { slug, itemId }, throwOnError: true });
    },

    onSettled: (_taken, _error, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
