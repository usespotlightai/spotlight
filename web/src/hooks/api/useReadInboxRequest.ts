import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { readInboxRequest } from '@/lib/api';

type ReadInboxRequestInput = {
  slug: string;
  requestId: string;
};

export function useReadInboxRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, requestId }: ReadInboxRequestInput) => {
      await readInboxRequest({ path: { slug, requestId }, throwOnError: true });
    },

    onSuccess: (_read, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
