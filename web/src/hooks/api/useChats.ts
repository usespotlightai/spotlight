import { usePagedList, type PagedList } from '@/hooks/api/usePagedList';
import { listChats, type ChatSummaryResponseDto } from '@/lib/api';
import { liveStaleTime, useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';

export const chatKeys = {
  all: ['chats'] as const,
  each: ['chat'] as const,
  forTeam: (teamId?: string) => ['chats', teamId ?? null] as const,
  one: (chatId?: string) => ['chat', chatId ?? null] as const,
};

const POLL_MS = 10_000;

export function useChats(
  teamId: string | undefined,
): PagedList<ChatSummaryResponseDto> {
  const livePollMs = useLivePoll(POLL_MS);

  return usePagedList({
    queryKey: chatKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    pollMs: livePollMs,
    staleTime: liveStaleTime,
    keyOf: (chat) => chat.id,
    fetchPage: async (before?: string) => {
      const { data } = await listChats({
        path: { teamId: required(teamId) },
        query: { before },
        throwOnError: true,
      });
      return data;
    },
  });
}
