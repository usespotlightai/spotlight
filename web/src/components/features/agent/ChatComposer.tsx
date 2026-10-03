import { useState } from 'react';
import { AgentPicker } from '@/components/features/stations/AgentPicker';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
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
  const [model, setModel] = useState(chat.model ?? '');
  const [effort, setEffort] = useState(chat.effort ?? '');

  return (
    <ChatInput
      slug={slug}
      label="Say something to the agent"
      placeholder="Reply…"
      pending={say.isPending}
      running={chat.working}
      onStop={() => stop.mutate({ teamId, chatId: chat.id })}
      settings={
        <AgentPicker
          harness={chat.harness}
          model={model}
          effort={effort}
          onModel={setModel}
          onEffort={setEffort}
        />
      }
      below={<FixedRepositories slug={slug} repositories={chat.repositories} />}
      onSend={({ body, attachments }, sent) =>
        say.mutate(
          { teamId, chatId: chat.id, body, attachments, model, effort },
          { onSuccess: sent },
        )
      }
    />
  );
}
