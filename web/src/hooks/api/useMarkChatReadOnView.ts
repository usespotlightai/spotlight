import { useEffect, useRef } from 'react';

import { useMarkInboxChatRead } from '@/hooks/api/useMarkInboxChatRead';
import type { Chat } from '@/lib/chat';

export function useMarkChatReadOnView(
  slug: string | undefined,
  chat?: Chat,
): void {
  const { mutate } = useMarkInboxChatRead();
  const seen = useRef<string | null>(null);
  const chatId = chat?.id;
  const messageCount = chat?.messages.length;

  useEffect(() => {
    if (
      slug === undefined ||
      slug === '' ||
      chatId === undefined ||
      chatId === ''
    ) {
      return;
    }

    const at = `${chatId}:${messageCount}`;

    if (seen.current === at) {
      return;
    }

    seen.current = at;
    mutate({ slug, chatId });
  }, [slug, chatId, messageCount, mutate]);
}
