import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { chatKeys } from '@/hooks/api/useChats';
import { useRunStream } from '@/hooks/api/useRunStream';
import type { Chat } from '@/lib/chat';

export function useChatRefresh(chatId: string | undefined, chat?: Chat) {
  const queryClient = useQueryClient();

  const bump = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.journal(chatId) });
    void queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) });
  }, [queryClient, chatId]);

  useRunStream(
    chat?.runId ?? undefined,
    Boolean(chat?.runId),
    chat?.progress ?? null,
    bump,
  );

  const progress = chat?.progress;
  const messageCount = chat?.messages.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the journal must update when a run stops or a new message comes, but the effect reads neither value
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.journal(chatId) });
  }, [queryClient, chatId, progress, messageCount]);
}
