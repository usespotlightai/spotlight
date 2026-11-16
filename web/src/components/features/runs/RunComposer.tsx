import { FixedAgent } from '@/components/features/stations/FixedAgent';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useSendMessage } from '@/hooks/api/useSendMessage';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useMe } from '@/hooks/useMe';
import { useSharedDraft } from '@/hooks/useSharedDraft';
import { heldByMe } from '@/lib/hold';
import { LINE_SETS_REPOSITORIES } from '@/lib/run';
import { holdsOnMessage, startsAgainOnMessage } from '@/lib/task';

type RunComposerProps = {
  slug: string;
  teamId: string;
  runId: string;
  taskId: string | undefined;
  station: string;
  stationId: string | undefined;
  running: boolean;
  answering: boolean;
  onSent?: () => void;
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
  onSent,
}: RunComposerProps) {
  const send = useSendMessage();
  const stop = useStopRun();
  const {
    line,
    station: currentStation,
    task,
  } = useTaskStation(teamId, taskId);
  const me = useMe();
  const driving = heldByMe(task?.hold, me?.id);
  const restarts =
    !answering &&
    !driving &&
    startsAgainOnMessage(task, currentStation, stationId);
  const holds = !answering && holdsOnMessage(task, currentStation, stationId);
  const shared = useSharedDraft(taskId);

  return (
    <ChatInput
      slug={slug}
      label={
        answering
          ? `Answer ${station}`
          : restarts
            ? `Send it back to ${station}`
            : `Message ${station}`
      }
      placeholder={
        answering
          ? 'Answer the question to continue the run…'
          : driving
            ? 'Tell the agent what to do next…'
            : holds
              ? running
                ? 'Your message stops the run and puts the task on hold…'
                : 'Your message puts the task on hold…'
              : restarts
                ? 'Say what to change…'
                : 'Write a message…'
      }
      pending={send.isPending}
      running={running}
      shared={shared}
      settings={<FixedAgent agent={currentStation} />}
      below={
        <FixedRepositories
          slug={slug}
          repositories={(line?.repositories ?? []).map((each) => each.fullName)}
          because={LINE_SETS_REPOSITORIES}
        />
      }
      onStop={() => stop.mutate({ teamId, runId })}
      onSend={(
        { body, attachments, files, coAuthors, draftGeneration },
        restore,
      ) => {
        send.mutate(
          {
            teamId,
            runId,
            body,
            attachments,
            files,
            coAuthors,
            draftGeneration,
            answers: answering,
            startsWork: answering || restarts || driving || holds,
          },
          { onError: restore },
        );
        onSent?.();
      }}
    />
  );
}
