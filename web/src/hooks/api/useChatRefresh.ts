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

  useRunStream(chat?.runId ?? undefined, Boolean(chat?.working), bump);

  const working = chat?.working;
  const said = chat?.messages.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a run settling or a new message is what the journal has to catch up with, though the effect reads neither
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.journal(chatId) });
  }, [queryClient, chatId, working, said]);
}
