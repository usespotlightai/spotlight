import { useQuery } from '@tanstack/react-query';
import { listChats } from '@/lib/api';

export const chatKeys = {
  forTeam: (teamId?: string) => ['chats', teamId ?? null] as const,
  one: (chatId?: string) => ['chat', chatId ?? null] as const,
  journal: (chatId?: string) => ['chat-journal', chatId ?? null] as const,
};

const POLL_MS = 10_000;

export function useChats(teamId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await listChats({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
