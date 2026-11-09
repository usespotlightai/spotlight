import { useQuery } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { readChat } from '@/lib/api';
import { useLivePoll } from '@/lib/live';

const POLL_MS = 5_000;

export function useChat(
  teamId: string | undefined,
  chatId: string | undefined,
) {
  const pollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: chatKeys.one(chatId),
    enabled: Boolean(teamId && chatId),
    refetchInterval: (query) =>
      query.state.data?.progress === 'queued' ? POLL_MS : pollMs,
    queryFn: async () => {
      const { data } = await readChat({
        path: { teamId: teamId as string, chatId: chatId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
