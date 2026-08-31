import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { resolveInboxItem } from '@/lib/api';

type ResolveInboxItemInput = {
  slug: string;
  itemId: string;
};

export function useResolveInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, itemId }: ResolveInboxItemInput) => {
      await resolveInboxItem({ path: { slug, itemId }, throwOnError: true });
    },

    onSuccess: (_resolved, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
