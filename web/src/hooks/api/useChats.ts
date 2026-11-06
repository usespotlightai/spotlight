import { usePagedList } from '@/hooks/api/usePagedList';
import { listChats } from '@/lib/api';

export const chatKeys = {
  forTeam: (teamId?: string) => ['chats', teamId ?? null] as const,
  one: (chatId?: string) => ['chat', chatId ?? null] as const,
};

const POLL_MS = 10_000;

export function useChats(teamId: string | undefined) {
  return usePagedList({
    queryKey: chatKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    pollMs: POLL_MS,
    keyOf: (chat) => chat.id,
    fetchPage: async (before?: string) => {
      const { data } = await listChats({
        path: { teamId: teamId as string },
        query: { before },
        throwOnError: true,
      });
      return data;
    },
  });
}
