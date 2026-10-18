import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { sendChatMessage } from '@/lib/api';

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
      await sendChatMessage({
        path: { teamId, chatId },
        body: {
          body,
          attachments,
          model: model || null,
          effort: effort || null,
        },
        throwOnError: true,
      });
    },
    onSuccess: (_sent, { teamId, chatId }) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.forTeam(teamId),
      });
    },
  });
}
