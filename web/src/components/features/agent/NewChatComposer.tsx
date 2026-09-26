import { useState } from 'react';
import { PendingTraces } from '@/components/features/agent/PendingTraces';
import { Composer } from '@/components/features/inbox/conversation/Composer';
import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useStartChat } from '@/hooks/api/useStartChat';
import { useRemembered } from '@/hooks/useRemembered';
import type { SharedTrace } from '@/lib/chat';

const HARNESS_KEY = 'spotlight.chat-harness';

type NewChatComposerProps = {
  slug: string;
  teamId: string;
  traces?: readonly SharedTrace[];
  onStarted: (chatId: string) => void;
};

export function NewChatComposer({
  slug,
  teamId,
  traces: handed = [],
  onStarted,
}: NewChatComposerProps) {
  const { data: harnesses } = useHarnesses();
  const [held, remember] = useRemembered(HARNESS_KEY, '');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [repositories, setRepositories] = useState<string[]>([]);
  const [traces, setTraces] = useState(handed);
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
    <Composer
      slug={slug}
      label="Plan with the agent"
      placeholder="What are we planning?"
      pending={start.isPending || !harness}
      alongside={{
        count: traces.length,
        shown: (
          <PendingTraces
            traces={traces}
            onRemove={(taskId) =>
              setTraces((was) => was.filter((each) => each.taskId !== taskId))
            }
            className="px-1 pt-1 pb-2"
          />
        ),
      }}
      onSend={(body, attachments, sent) =>
        start.mutate(
          {
            teamId,
            harness,
            model: model || null,
            effort: effort || null,
            repositories,
            body,
            attachments,
            traces: traces.map((each) => each.taskId),
          },
          {
            onSuccess: (chat) => {
              sent();
              setTraces([]);
              onStarted(chat.id);
            },
          },
        )
      }
      context={
        <>
          <HarnessSelect
            value={harness}
            onChange={choose}
            allowNone={false}
            className="w-auto"
          />
          <ModelEffortSelect
            harness={harness}
            model={model}
            onModel={setModel}
            effort={effort}
            onEffort={setEffort}
            iconless
            className="-ml-1.5 w-auto"
          />
          <RepositoriesSelect
            slug={slug}
            value={repositories}
            onChange={setRepositories}
            className="w-auto"
          />
        </>
      }
    />
  );
}
