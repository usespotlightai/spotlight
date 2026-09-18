import { useQuery } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { readChatJournal } from '@/lib/api';

export function useChatJournal(
  teamId: string | undefined,
  chatId: string | undefined,
) {
  return useQuery({
    queryKey: chatKeys.journal(chatId),
    enabled: Boolean(teamId && chatId),
    queryFn: async () => {
      const { data } = await readChatJournal({
        path: { teamId: teamId as string, chatId: chatId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
