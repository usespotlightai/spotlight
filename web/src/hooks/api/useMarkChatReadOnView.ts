import { useEffect, useRef } from 'react';

import { useMarkInboxChatRead } from '@/hooks/api/useMarkInboxChatRead';
import type { Chat } from '@/lib/chat';

export function useMarkChatReadOnView(slug: string | undefined, chat?: Chat) {
  const { mutate } = useMarkInboxChatRead();
  const seen = useRef<string | null>(null);
  const chatId = chat?.id;
  const messageCount = chat?.messages.length;

  useEffect(() => {
    const at = chatId && `${chatId}:${messageCount}`;

    if (!slug || !chatId || !at || seen.current === at) {
      return;
    }

    seen.current = at;
    mutate({ slug, chatId });
  }, [slug, chatId, messageCount, mutate]);
}
