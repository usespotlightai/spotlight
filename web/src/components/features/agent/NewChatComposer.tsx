import { useState } from 'react';
import { AgentPicker } from '@/components/features/stations/AgentPicker';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRepositories } from '@/hooks/api/useRepositories';
import { useStartChat } from '@/hooks/api/useStartChat';
import { useChatDraft } from '@/hooks/useChatDraft';
import type { ChatSetup, SharedTrace, TargetStation } from '@/lib/chat';
import { prefillSignature, validSettings } from '@/lib/chat-draft';
import { stationReference, traceReference } from '@/lib/chat-input';
import { messageOf } from '@/lib/error';

type NewChatComposerProps = {
  slug: string;
  teamId: string;
  traces: readonly SharedTrace[];
  defaultTargetStation: TargetStation | null;
  defaultPrompt?: string | null;
  defaultRepositories?: readonly string[];
  setup?: ChatSetup | null;
  onStarted: (chatId: string) => void;
};

export function NewChatComposer({
  slug,
  teamId,
  traces: handed,
  defaultTargetStation,
  defaultPrompt,
  defaultRepositories = [],
  setup,
  onStarted,
}: NewChatComposerProps) {
  const { data: harnesses } = useHarnesses();
  const { data: available } = useRepositories(slug);
  const start = useStartChat();
  const [references] = useState(() => [
    ...(defaultTargetStation ? [stationReference(defaultTargetStation)] : []),
    ...handed.map(traceReference),
  ]);
  const draft = useChatDraft(
    slug,
    'new',
    prefillSignature({
      text: defaultPrompt,
      references,
      repositories: defaultRepositories,
      setup,
    }),
  );
  const [chosen, setChosen] = useState({
    harness: draft.settings.harness ?? '',
    model: draft.settings.model ?? '',
    effort: draft.settings.effort ?? '',
  });
  const [picked, setPicked] = useState<readonly string[]>(() =>
    draft.fresh && defaultRepositories.length > 0
      ? defaultRepositories
      : (draft.settings.repositories ?? defaultRepositories),
  );

  const { harness, model, effort } = harnesses
    ? validSettings(chosen, harnesses, harnesses[0]?.id ?? '')
    : { harness: '', model: '', effort: '' };
  const offered = new Set([
    ...defaultRepositories,
    ...(available ?? []).map((each) => each.fullName),
  ]);
  const repositories = available
    ? picked.filter((each) => offered.has(each))
    : [...picked];

  const choose = (patch: Partial<typeof chosen>) => {
    setChosen((was) => ({ ...was, ...patch }));
    draft.save(patch);
  };

  const chooseRepositories = (next: string[]) => {
    setPicked(next);
    draft.save({ repositories: next });
  };

  return (
    <ChatInput
      slug={slug}
      label="Plan with the agent"
      placeholder="What do you want to plan?"
      pending={start.isPending || !harness}
      draft={draft}
      initialReferences={references}
      initialText={defaultPrompt ?? undefined}
      settings={
        <AgentPicker
          harness={harness}
          model={model}
          effort={effort}
          onHarness={(next) => choose({ harness: next, model: '', effort: '' })}
          onModel={(next) => choose({ model: next })}
          onEffort={(next) => choose({ effort: next })}
        />
      }
      below={
        <>
          <RepositoriesSelect
            slug={slug}
            value={repositories}
            onChange={chooseRepositories}
            className="h-6 w-auto"
          />
          {start.isError && (
            <p
              role="alert"
              className="w-full text-destructive text-sm leading-6"
            >
              {messageOf(start.error, 'Sorry, the chat could not start.')}
            </p>
          )}
        </>
      }
      onSend={({ body, attachments, traces, targetStation }, sent) =>
        start.mutate(
          {
            teamId,
            harness,
            model: model || null,
            effort: effort || null,
            repositories,
            body,
            attachments,
            traces,
            ...(targetStation ? { targetStation } : {}),
            ...(setup ? { setup } : {}),
          },
          {
            onSuccess: (chat) => {
              sent();
              onStarted(chat.id);
            },
          },
        )
      }
    />
  );
}
