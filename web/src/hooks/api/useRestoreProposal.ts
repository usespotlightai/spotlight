import { useMutation, useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { restoreProposal } from '@/lib/api';
import { type Chat, decidedIn } from '@/lib/chat';
import { refreshAfterWrite } from '@/lib/live-writes';

type RestoreProposalInput = {
  teamId: string;
  chatId: string;
  position: number;
};

export function useRestoreProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, chatId, position }: RestoreProposalInput) => {
      const { response } = await restoreProposal({
        path: { teamId, chatId, position },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        inboxKeys.all,
        chatKeys.one(chatId),
      ]);
    },
    onMutate: async ({ chatId, position }) => {
      const key = chatKeys.one(chatId);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Chat>(
        key,
        (chat) => chat && decidedIn(chat, position, 'open'),
      );
    },
    onError: (_error, { chatId }) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) });
    },
  });
}
