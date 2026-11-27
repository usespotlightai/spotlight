import { type ReactElement, useState } from 'react';

import { AgentPicker } from '@/components/features/stations/AgentPicker';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useSendChatMessage } from '@/hooks/api/useSendChatMessage';
import { useSession } from '@/hooks/api/useSession';
import { useStopChat } from '@/hooks/api/useStopChat';
import { useChatDraft } from '@/hooks/useChatDraft';
import { CHAT_KEEPS_REPOSITORIES, type Chat } from '@/lib/chat';
import { validSettings } from '@/lib/chat-draft';

type ChatComposerProps = {
  slug: string;
  teamId: string;
  chat: Chat;
};

export function ChatComposer({
  slug,
  teamId,
  chat,
}: ChatComposerProps): ReactElement {
  const send = useSendChatMessage();
  const { data: session } = useSession();
  const stop = useStopChat();
  const { data: harnesses } = useHarnesses();
  const draft = useChatDraft(slug, `chat:${chat.id}`, '');
  const [chosen, setChosen] = useState({
    model: draft.settings.model,
    effort: draft.settings.effort,
  });
  const valid = harnesses
    ? validSettings(chosen, harnesses, chat.harness)
    : { model: chosen.model ?? '', effort: chosen.effort ?? '' };
  const model = chosen.model === undefined ? (chat.model ?? '') : valid.model;
  const effort =
    chosen.effort === undefined ? (chat.effort ?? '') : valid.effort;

  const choose = (patch: { model?: string; effort?: string }) => {
    setChosen((was) => ({ ...was, ...patch }));
    draft.save(patch);
  };

  return (
    <ChatInput
      slug={slug}
      draft={draft}
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
          onModel={(next) => choose({ model: next })}
          onEffort={(next) => choose({ effort: next })}
        />
      }
      below={
        <FixedRepositories
          slug={slug}
          repositories={chat.repositories}
          because={CHAT_KEEPS_REPOSITORIES}
        />
      }
      onSend={({ body, attachments, files }, restore) =>
        send.mutate(
          {
            teamId,
            chatId: chat.id,
            body,
            attachments,
            model,
            effort,
            shown: {
              body,
              attachments: files,
              author: session
                ? {
                    id: session.user.id,
                    name: session.user.name,
                    image: session.user.image,
                  }
                : null,
            },
          },
          { onError: restore },
        )
      }
    />
  );
}
