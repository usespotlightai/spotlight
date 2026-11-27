import { MessageSquare } from 'lucide-react';
import type { ReactElement } from 'react';

import { InboxRowFrame } from '@/components/features/inbox/InboxRowFrame';
import { usePrefetchChatJournal } from '@/hooks/api/useChatJournal';
import { useMarkInboxChatRead } from '@/hooks/api/useMarkInboxChatRead';
import { useResolveAction } from '@/hooks/useResolveAction';
import { chatPreviewOf, type InboxChat, inboxChatPath } from '@/lib/inbox';

type ChatRowProps = {
  slug: string;
  chat: InboxChat;
};

export function ChatRow({ slug, chat }: ChatRowProps): ReactElement {
  const resolve = useResolveAction(slug, chat);
  const markRead = useMarkInboxChatRead();
  const prefetch = usePrefetchChatJournal();

  return (
    <InboxRowFrame
      to={inboxChatPath(slug, chat.teamId, chat.id)}
      onOpen={() => markRead.mutate({ slug, chatId: chat.id })}
      onIntent={() => prefetch(chat.teamId, chat.id)}
      icon={
        <MessageSquare
          aria-hidden
          data-slot="chat-icon"
          className="size-4 shrink-0 text-muted-foreground"
        />
      }
      title={chat.title}
      unread={chat.unread}
      at={chat.askedAt}
      preview={chatPreviewOf(chat)}
      resolve={resolve}
    />
  );
}
