import { FixedAgent } from '@/components/features/stations/FixedAgent';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useSendMessage } from '@/hooks/api/useSendMessage';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { startsAgainOnMessage } from '@/lib/task';

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
  const send = useSendMessage();
  const stop = useStopRun();
  const {
    line,
    station: currentStation,
    task,
  } = useTaskStation(teamId, taskId);
  const restarts =
    !answering && startsAgainOnMessage(task, currentStation, stationId);

  return (
    <ChatInput
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
          ? 'Answer the question to continue the run…'
          : restarts
            ? `Say what to change. ${station} starts again…`
            : 'Say something…'
      }
      pending={send.isPending}
      running={running}
      settings={<FixedAgent agent={currentStation} />}
      below={
        <FixedRepositories
          slug={slug}
          repositories={line?.repositories ?? []}
        />
      }
      onStop={() => stop.mutate({ teamId, runId })}
      onSend={({ body, attachments }, sent) =>
        send.mutate({ teamId, runId, body, attachments }, { onSuccess: sent })
      }
    />
  );
}
