import { Composer } from '@/components/features/inbox/conversation/Composer';
import { useSayToRun } from '@/hooks/api/useSayToRun';
import { useStopRun } from '@/hooks/api/useStopRun';

type RunComposerProps = {
  slug: string;
  teamId: string;
  runId: string;
  station: string;
  running: boolean;
};

export function RunComposer({
  slug,
  teamId,
  runId,
  station,
  running,
}: RunComposerProps) {
  const say = useSayToRun();
  const stop = useStopRun();

  return (
    <Composer
      slug={slug}
      label={`Say something to ${station}`}
      placeholder="Say something…"
      pending={say.isPending}
      running={running}
      onStop={() => stop.mutate({ teamId, runId })}
      onSend={(body, attachments, sent) =>
        say.mutate({ teamId, runId, body, attachments }, { onSuccess: sent })
      }
    />
  );
}
