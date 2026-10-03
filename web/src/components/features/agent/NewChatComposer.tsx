import { useState } from 'react';
import { PendingImprovement } from '@/components/features/agent/PendingImprovement';
import { AgentPicker } from '@/components/features/stations/AgentPicker';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useStartChat } from '@/hooks/api/useStartChat';
import { useRemembered } from '@/hooks/useRemembered';
import type { ImprovedStation, SharedTrace } from '@/lib/chat';

const HARNESS_KEY = 'spotlight.chat-harness';

type NewChatComposerProps = {
  slug: string;
  teamId: string;
  traces: readonly SharedTrace[];
  improving: ImprovedStation | null;
  onStarted: (chatId: string) => void;
};

export function NewChatComposer({
  slug,
  teamId,
  traces: handed,
  improving: handedStation,
  onStarted,
}: NewChatComposerProps) {
  const { data: harnesses } = useHarnesses();
  const [held, remember] = useRemembered(HARNESS_KEY, '');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [repositories, setRepositories] = useState<string[]>([]);
  const [improving, setImproving] = useState(handedStation);
  const start = useStartChat();

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
      placeholder={
        improving ? 'What should it do better?' : 'What are we planning?'
      }
      pending={start.isPending || !harness}
      initialTraces={handed}
      above={
        improving && (
          <div className="flex pb-2">
            <PendingImprovement
              station={improving}
              onRemove={() => setImproving(null)}
            />
          </div>
        )
      }
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
      onSend={({ body, attachments, traces }, sent) =>
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
            ...(improving ? { improving: improving.stationId } : {}),
          },
          {
            onSuccess: (chat) => {
              sent();
              setImproving(null);
              onStarted(chat.id);
            },
          },
        )
      }
    />
  );
}
