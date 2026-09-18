import { Composer } from '@/components/features/inbox/conversation/Composer';
import { FixedSettings } from '@/components/features/stations/FixedSettings';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';

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
  const { line, station: standing } = useTaskStation(teamId, taskId);

  return (
    <Composer
      slug={slug}
      label={`Answer ${station}`}
      placeholder="Reply…"
      pending={answer.isPending}
      running={running && runId !== null}
      context={
        <FixedSettings
          slug={slug}
          harness={standing?.harness}
          model={standing?.model}
          effort={standing?.effort}
          repositories={line?.repositories ?? []}
        />
      }
      onStop={runId ? () => stop.mutate({ teamId, runId }) : undefined}
      onSend={(body, attachments, sent) =>
        answer.mutate({ slug, itemId, body, attachments }, { onSuccess: sent })
      }
    />
  );
}
