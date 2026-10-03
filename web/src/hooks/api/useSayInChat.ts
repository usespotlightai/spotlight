import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { sayInChat } from '@/lib/api';

type SayInChatInput = {
  teamId: string;
  chatId: string;
  body: string;
  attachments: string[];
  model: string;
  effort: string;
};

export function useSayInChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      chatId,
      body,
      attachments,
      model,
      effort,
    }: SayInChatInput) => {
      await sayInChat({
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
    onSuccess: (_said, { teamId, chatId }) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.forTeam(teamId),
      });
    },
  });
}
