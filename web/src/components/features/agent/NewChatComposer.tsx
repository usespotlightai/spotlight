import { useState } from 'react';
import { AgentPicker } from '@/components/features/stations/AgentPicker';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useStartChat } from '@/hooks/api/useStartChat';
import { useRemembered } from '@/hooks/useRemembered';
import type { ImprovedStation, SharedTrace } from '@/lib/chat';
import { stationReference, traceReference } from '@/lib/chat-input';

const HARNESS_KEY = 'spotlight.chat-harness';

type NewChatComposerProps = {
  slug: string;
  teamId: string;
  traces: readonly SharedTrace[];
  defaultImproving: ImprovedStation | null;
  onStarted: (chatId: string) => void;
};

export function NewChatComposer({
  slug,
  teamId,
  traces: handed,
  defaultImproving,
  onStarted,
}: NewChatComposerProps) {
  const { data: harnesses } = useHarnesses();
  const [held, remember] = useRemembered(HARNESS_KEY, '');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [repositories, setRepositories] = useState<string[]>([]);
  const start = useStartChat();
  const [references] = useState(() => [
    ...(defaultImproving ? [stationReference(defaultImproving)] : []),
    ...handed.map(traceReference),
  ]);

  const harness = harnesses?.some((each) => each.id === held)
    ? held
    : (harnesses?.[0]?.id ?? '');

  const choose = (next: string) => {
    remember(next);
    setModel('');
    setEffort('');
  };

  return (
    <ChatInput
      slug={slug}
      label="Plan with the agent"
      placeholder="What do you want to plan?"
      pending={start.isPending || !harness}
      initialReferences={references}
      settings={
        <AgentPicker
          harness={harness}
          model={model}
          effort={effort}
          onHarness={choose}
          onModel={setModel}
          onEffort={setEffort}
        />
      }
      below={
        <RepositoriesSelect
          slug={slug}
          value={repositories}
          onChange={setRepositories}
          className="h-6 w-auto"
        />
      }
      onSend={({ body, attachments, traces, improving }, sent) =>
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
            ...(improving ? { improving } : {}),
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
