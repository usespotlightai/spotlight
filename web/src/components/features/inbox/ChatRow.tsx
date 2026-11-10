import { MessageSquare } from 'lucide-react';
import { InboxRowFrame } from '@/components/features/inbox/InboxRowFrame';
import { ResolveToggle } from '@/components/features/inbox/ResolveToggle';
import { useMarkInboxChatRead } from '@/hooks/api/useMarkInboxChatRead';
import { chatPreviewOf, type InboxChat, inboxChatPath } from '@/lib/inbox';

type ChatRowProps = {
  slug: string;
  chat: InboxChat;
};

export function ChatRow({ slug, chat }: ChatRowProps) {
  const markRead = useMarkInboxChatRead();

  return (
    <InboxRowFrame
      to={inboxChatPath(slug, chat.teamId, chat.id)}
      onOpen={() => markRead.mutate({ slug, chatId: chat.id })}
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
      action={<ResolveToggle slug={slug} entry={chat} />}
    />
  );
}
