import { Composer } from '@/components/features/inbox/conversation/Composer';
import { FixedSettings } from '@/components/features/stations/FixedSettings';
import { useSayToRun } from '@/hooks/api/useSayToRun';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { startsAgainWhenTold } from '@/lib/task';

type RunComposerProps = {
  slug: string;
  teamId: string;
  runId: string;
  taskId: string | undefined;
  station: string;
  stationId: string | undefined;
  running: boolean;
  answering: boolean;
};

export function RunComposer({
  slug,
  teamId,
  runId,
  taskId,
  station,
  stationId,
  running,
  answering,
}: RunComposerProps) {
  const say = useSayToRun();
  const stop = useStopRun();
  const { line, station: standing, task } = useTaskStation(teamId, taskId);
  const restarts = !answering && startsAgainWhenTold(task, standing, stationId);

  return (
    <Composer
      slug={slug}
      label={
        answering
          ? `Answer ${station}`
          : restarts
            ? `Send it back to ${station}`
            : `Say something to ${station}`
      }
      placeholder={
        answering
          ? 'Answer the question, and the run carries on…'
          : restarts
            ? `Say what to change, and ${station} starts again…`
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
