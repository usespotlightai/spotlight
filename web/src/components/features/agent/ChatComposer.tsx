import { useState } from 'react';
import { AgentPicker } from '@/components/features/stations/AgentPicker';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useSendChatMessage } from '@/hooks/api/useSendChatMessage';
import { useStopChat } from '@/hooks/api/useStopChat';
import type { Chat } from '@/lib/chat';

type ChatComposerProps = {
  slug: string;
  teamId: string;
  chat: Chat;
};

export function ChatComposer({ slug, teamId, chat }: ChatComposerProps) {
  const send = useSendChatMessage();
  const stop = useStopChat();
  const [model, setModel] = useState(chat.model ?? '');
  const [effort, setEffort] = useState(chat.effort ?? '');

  return (
    <ChatInput
      slug={slug}
      label="Message the agent"
      placeholder="Reply…"
      pending={send.isPending}
      running={chat.progress === 'in-progress'}
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
        send.mutate(
          { teamId, chatId: chat.id, body, attachments, model, effort },
          { onSuccess: sent },
        )
      }
    />
  );
}
