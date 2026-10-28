import { FixedAgent } from '@/components/features/stations/FixedAgent';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useSharedDraft } from '@/hooks/useSharedDraft';
import { LINE_SETS_REPOSITORIES } from '@/lib/run';

type InboxComposerProps = {
  slug: string;
  itemId: string;
  taskId: string;
  station: string;
  teamId: string;
  runId: string | null;
  running: boolean;
};

export function InboxComposer({
  slug,
  itemId,
  taskId,
  station,
  teamId,
  runId,
  running,
}: InboxComposerProps) {
  const answer = useAnswerInboxItem();
  const stop = useStopRun();
  const { line, station: currentStation } = useTaskStation(teamId, taskId);
  const shared = useSharedDraft(taskId);

  return (
    <ChatInput
      slug={slug}
      label={`Answer ${station}`}
      placeholder="Reply…"
      pending={answer.isPending}
      running={running}
      shared={shared}
      settings={<FixedAgent agent={currentStation} />}
      below={
        <FixedRepositories
          slug={slug}
          repositories={line?.repositories ?? []}
          because={LINE_SETS_REPOSITORIES}
        />
      }
      onStop={runId ? () => stop.mutate({ teamId, runId }) : undefined}
      onSend={({ body, attachments, coAuthors, draftGeneration }, sent) =>
        answer.mutate(
          { slug, itemId, body, attachments, coAuthors, draftGeneration },
          { onSuccess: sent },
        )
      }
    />
  );
}
