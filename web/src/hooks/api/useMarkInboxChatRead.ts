import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { markInboxChatRead } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';

type MarkInboxChatReadInput = {
  slug: string;
  chatId: string;
};

export function useMarkInboxChatRead() {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 1,

    mutationFn: async ({ slug, chatId }: MarkInboxChatReadInput) => {
      const { response } = await markInboxChatRead({
        path: { slug, chatId },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        inboxKeys.forWorkspace(slug),
      ]);
    },
  });
}
