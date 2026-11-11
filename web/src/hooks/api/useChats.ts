import { usePagedList } from '@/hooks/api/usePagedList';
import { listChats } from '@/lib/api';
import { useLivePoll } from '@/lib/live';

export const chatKeys = {
  all: ['chats'] as const,
  each: ['chat'] as const,
  forTeam: (teamId?: string) => ['chats', teamId ?? null] as const,
  one: (chatId?: string) => ['chat', chatId ?? null] as const,
};

const POLL_MS = 10_000;

export function useChats(teamId: string | undefined) {
  const livePollMs = useLivePoll(POLL_MS);

  return usePagedList({
    queryKey: chatKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    pollMs: livePollMs,
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
