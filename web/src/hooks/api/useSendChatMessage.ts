import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { sendChatMessage } from '@/lib/api';
import {
  type Chat,
  type SentMessage,
  sentTo,
  withoutMessage,
} from '@/lib/chat';
import { refreshAfterWrite } from '@/lib/live-writes';

type SendChatMessageInput = {
  teamId: string;
  chatId: string;
  body: string;
  attachments: string[];
  model: string;
  effort: string;
  shown: SentMessage;
};

export function useSendChatMessage(): UseMutationResult<
  void,
  Error,
  SendChatMessageInput,
  { position: number | null }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      chatId,
      body,
      attachments,
      model,
      effort,
    }: SendChatMessageInput) => {
      const { response } = await sendChatMessage({
        path: { teamId, chatId },
        body: {
          body,
          attachments,
          model: model || null,
          effort: effort || null,
        },
        throwOnError: true,
      });
      void refreshAfterWrite(queryClient, response, [
        chatKeys.one(chatId),
        inboxKeys.all,
        chatKeys.forTeam(teamId),
      ]);
    },
    onMutate: async ({ chatId, shown }) => {
      const key = chatKeys.one(chatId);
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<Chat>(key);
      if (!before) {
        return { position: null };
      }

      const after = sentTo(before, shown, new Date().toISOString());
      queryClient.setQueryData<Chat>(key, after);

      return { position: after.messages.at(-1)?.position ?? null };
    },
    onError: (_error, { chatId }, context) => {
      const key = chatKeys.one(chatId);
      const position = context?.position;
      if (position !== null && position !== undefined) {
        queryClient.setQueryData<Chat>(
          key,
          (chat) => chat && withoutMessage(chat, position),
        );
      }
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
