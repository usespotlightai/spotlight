import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { readChat, type ChatResponseDto } from '@/lib/api';
import { useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';

const POLL_MS = 5_000;

export function useChat(
  teamId: string | undefined,
  chatId: string | undefined,
): UseQueryResult<ChatResponseDto> {
  const pollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: chatKeys.one(chatId),
    enabled:
      teamId !== undefined &&
      teamId !== '' &&
      chatId !== undefined &&
      chatId !== '',
    refetchInterval: (query) =>
      query.state.data?.progress === 'queued' ? POLL_MS : pollMs,
    queryFn: async () => {
      const { data } = await readChat({
        path: { teamId: required(teamId), chatId: required(chatId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
