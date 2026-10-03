import { useEffect, useRef, useState } from 'react';
import { useLingering } from '@/hooks/useLingering';
import { type Chat, newlyProposed } from '@/lib/chat';

const LEAVING = 240;

export function useOpenProposal(chatId: string | undefined, chat?: Chat) {
  const [opened, setOpened] = useState<{
    chatId: string;
    position: number;
  } | null>(null);

  const openAt = chatId && opened?.chatId === chatId ? opened.position : null;
  const heldAt = useLingering(openAt, LEAVING);
  const shown =
    heldAt === null ? null : (chat?.messages[heldAt]?.proposal ?? null);

  const toggle = (position: number) =>
    setOpened(openAt === position || !chatId ? null : { chatId, position });

  const close = () => setOpened(null);

  const seen = useRef<{ chatId: string; count: number } | null>(null);

  useEffect(() => {
    if (!chat) {
      return;
    }

    const was = seen.current;
    seen.current = { chatId: chat.id, count: chat.messages.length };

    if (was?.chatId !== chat.id) {
      return;
    }

    const position = newlyProposed(chat.messages, was.count);

    if (position !== null) {
      setOpened({ chatId: chat.id, position });
    }
  }, [chat]);

  return { openAt, heldAt, shown, toggle, close };
}
