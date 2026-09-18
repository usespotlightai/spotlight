import { Composer } from '@/components/features/inbox/conversation/Composer';
import { FixedSettings } from '@/components/features/stations/FixedSettings';
import { useSayInChat } from '@/hooks/api/useSayInChat';
import { useStopChat } from '@/hooks/api/useStopChat';
import type { Chat } from '@/lib/chat';

type ChatComposerProps = {
  slug: string;
  teamId: string;
  chat: Chat;
};

export function ChatComposer({ slug, teamId, chat }: ChatComposerProps) {
  const say = useSayInChat();
  const stop = useStopChat();

  return (
    <Composer
      slug={slug}
      label="Say something to the agent"
      placeholder="Reply…"
      pending={say.isPending}
      running={chat.working}
      context={
        <FixedSettings
          slug={slug}
          harness={chat.harness}
          model={chat.model}
          effort={chat.effort}
          repositories={chat.repositories}
        />
      }
      onStop={() => stop.mutate({ teamId, chatId: chat.id })}
      onSend={(body, attachments, sent) =>
        say.mutate(
          { teamId, chatId: chat.id, body, attachments },
          { onSuccess: sent },
        )
      }
    />
  );
}
