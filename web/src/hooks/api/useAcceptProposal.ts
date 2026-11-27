import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { taskKeys } from '@/hooks/api/useTasks';
import { acceptProposal } from '@/lib/api';
import { type Chat, decidedIn } from '@/lib/chat';
import { refreshAfterWrite } from '@/lib/live-writes';

type AcceptProposalInput = {
  teamId: string;
  chatId: string;
  position: number;
};

export function useAcceptProposal(): UseMutationResult<
  void,
  Error,
  AcceptProposalInput,
  void
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, chatId, position }: AcceptProposalInput) => {
      const { response } = await acceptProposal({
        path: { teamId, chatId, position },
        throwOnError: true,
      });
      void refreshAfterWrite(queryClient, response, [
        chatKeys.one(chatId),
        inboxKeys.all,
        taskKeys.forTeam(teamId),
      ]);
    },
    onMutate: async ({ chatId, position }) => {
      const key = chatKeys.one(chatId);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Chat>(
        key,
        (chat) => chat && decidedIn(chat, position, 'accepted'),
      );
    },
    onError: (_error, { chatId }) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) });
    },
  });
}
