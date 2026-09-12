import { Composer } from '@/components/features/inbox/conversation/Composer';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';
import { useStopRun } from '@/hooks/api/useStopRun';

type InboxComposerProps = {
  slug: string;
  itemId: string;
  station: string;
  teamId: string;
  runId: string | null;
  running: boolean;
};

export function InboxComposer({
  slug,
  itemId,
  station,
  teamId,
  runId,
  running,
}: InboxComposerProps) {
  const answer = useAnswerInboxItem();
  const stop = useStopRun();

  return (
    <Composer
      slug={slug}
      label={`Answer ${station}`}
      placeholder="Reply…"
      pending={answer.isPending}
      running={running && runId !== null}
      onStop={runId ? () => stop.mutate({ teamId, runId }) : undefined}
      onSend={(body, attachments, sent) =>
        answer.mutate({ slug, itemId, body, attachments }, { onSuccess: sent })
      }
    />
  );
}
