import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { stopChat } from '@/lib/api';

type StopChatInput = { teamId: string; chatId: string };

export function useStopChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, chatId }: StopChatInput) => {
      await stopChat({ path: { teamId, chatId }, throwOnError: true });
    },
    onSuccess: (_stopped, { chatId }) =>
      queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) }),
  });
}
