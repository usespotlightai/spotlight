import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { stopChat } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';

type StopChatInput = { teamId: string; chatId: string };

export function useStopChat(): UseMutationResult<void, Error, StopChatInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, chatId }: StopChatInput) => {
      const { response } = await stopChat({
        path: { teamId, chatId },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        inboxKeys.all,
        chatKeys.one(chatId),
      ]);
    },
  });
}
