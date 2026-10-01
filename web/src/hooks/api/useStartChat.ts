import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { startChat } from '@/lib/api';

type StartChatInput = {
  teamId: string;
  harness: string;
  model: string | null;
  effort: string | null;
  repositories: string[];
  body: string;
  attachments: string[];
  traces: string[];
  improving?: string;
};

export function useStartChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, ...body }: StartChatInput) => {
      const { data } = await startChat({
        path: { teamId },
        body,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (chat, { teamId }) => {
      queryClient.setQueryData(chatKeys.one(chat.id), chat);
      void queryClient.invalidateQueries({
        queryKey: chatKeys.forTeam(teamId),
      });
    },
  });
}
