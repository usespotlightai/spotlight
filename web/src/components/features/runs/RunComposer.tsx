import { Composer } from '@/components/features/inbox/conversation/Composer';
import { FixedSettings } from '@/components/features/stations/FixedSettings';
import { useSayToRun } from '@/hooks/api/useSayToRun';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';

type RunComposerProps = {
  slug: string;
  teamId: string;
  runId: string;
  taskId: string | undefined;
  station: string;
  running: boolean;
  answering: boolean;
};

export function RunComposer({
  slug,
  teamId,
  runId,
  taskId,
  station,
  running,
  answering,
}: RunComposerProps) {
  const say = useSayToRun();
  const stop = useStopRun();
  const { line, station: standing } = useTaskStation(teamId, taskId);

  return (
    <Composer
      slug={slug}
      label={answering ? `Answer ${station}` : `Say something to ${station}`}
      placeholder={
        answering
          ? 'Answer the question, and the run carries on…'
          : 'Say something…'
      }
      pending={say.isPending}
      running={running}
      context={
        <FixedSettings
          slug={slug}
          harness={standing?.harness}
          model={standing?.model}
          effort={standing?.effort}
          repositories={line?.repositories ?? []}
        />
      }
      onStop={() => stop.mutate({ teamId, runId })}
      onSend={(body, attachments, sent) =>
        say.mutate({ teamId, runId, body, attachments }, { onSuccess: sent })
      }
    />
  );
}
