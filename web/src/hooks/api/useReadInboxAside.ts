import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { readInboxAside } from '@/lib/api';

type ReadInboxAsideInput = {
  slug: string;
  asideId: string;
};

export function useReadInboxAside() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, asideId }: ReadInboxAsideInput) => {
      await readInboxAside({ path: { slug, asideId }, throwOnError: true });
    },

    onSuccess: (_read, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
