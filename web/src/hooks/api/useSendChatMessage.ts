import { useMutation, useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { sendChatMessage } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';

type SendChatMessageInput = {
  teamId: string;
  chatId: string;
  body: string;
  attachments: string[];
  model: string;
  effort: string;
};

export function useSendChatMessage() {
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
  });
}
