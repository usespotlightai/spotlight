import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { markInboxChatRead } from '@/lib/api';

type MarkInboxChatReadInput = {
  slug: string;
  chatId: string;
};

export function useMarkInboxChatRead() {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 1,

    mutationFn: async ({ slug, chatId }: MarkInboxChatReadInput) => {
      await markInboxChatRead({ path: { slug, chatId }, throwOnError: true });
    },

    onSuccess: (_read, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
