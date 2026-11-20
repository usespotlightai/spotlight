import { FixedAgent } from '@/components/features/stations/FixedAgent';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useSendMessage, useSendTaskMessage } from '@/hooks/api/useSendMessage';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useMe } from '@/hooks/useMe';
import { useSharedDraft } from '@/hooks/useSharedDraft';
import { heldByMe } from '@/lib/hold';
import { LINE_SETS_REPOSITORIES } from '@/lib/run';
import { holdsOnMessage, startsAgainOnMessage } from '@/lib/task';

type Target =
  | { runId: string; taskId: string | undefined }
  | { runId: null; taskId: string };

type RunComposerProps = Target & {
  slug: string;
  teamId: string;
  station: string;
  stationId: string | undefined;
  running: boolean;
  answering: boolean;
  onSent?: () => void;
};

type Mode = 'answering' | 'driving' | 'holds' | 'restarts' | 'message';

type Flags = Record<Exclude<Mode, 'message'>, boolean>;

const modeOf = (flags: Flags): Mode =>
  (['answering', 'driving', 'holds', 'restarts'] as const).find(
    (each) => flags[each],
  ) ?? 'message';

const labelFor = (mode: Mode, station: string): string => {
  if (mode === 'answering') {
    return `Answer ${station}`;
  }
  if (mode === 'restarts') {
    return `Send it back to ${station}`;
  }
  return `Message ${station}`;
};

export const WRITE_A_MESSAGE = 'Write a message…';

const PLACEHOLDERS: Record<Mode, string> = {
  answering: 'Answer the question to continue the run…',
  driving: 'Tell the agent what to do next…',
  holds: 'Your message puts the task on hold…',
  restarts: 'Say what to change…',
  message: WRITE_A_MESSAGE,
};

const placeholderFor = (mode: Mode, running: boolean): string =>
  mode === 'holds' && running
    ? 'Your message stops the run and puts the task on hold…'
    : PLACEHOLDERS[mode];

export function RunComposer({
  slug,
  teamId,
  station,
  stationId,
  running,
  answering,
  onSent,
  ...target
}: RunComposerProps) {
  const { runId, taskId } = target;
  const send = useSendMessage();
  const sendToTask = useSendTaskMessage();
  const stop = useStopRun();
  const {
    line,
    station: currentStation,
    task,
  } = useTaskStation(teamId, taskId);
  const me = useMe();
  const mode = modeOf({
    answering,
    driving: heldByMe(task?.hold, me?.id),
    holds: holdsOnMessage(task, currentStation, stationId),
    restarts: startsAgainOnMessage(task, currentStation, stationId),
  });
  const shared = useSharedDraft(taskId);

  return (
    <ChatInput
      slug={slug}
      label={labelFor(mode, station)}
      placeholder={placeholderFor(mode, running)}
      pending={send.isPending || sendToTask.isPending}
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
      onStop={runId ? () => stop.mutate({ teamId, runId }) : undefined}
      onSend={(
        { body, attachments, files, coAuthors, draftGeneration },
        restore,
      ) => {
        if (target.runId === null) {
          sendToTask.mutate(
            {
              teamId,
              taskId: target.taskId,
              body,
              attachments,
              coAuthors,
              draftGeneration,
            },
            { onError: restore, onSuccess: onSent },
          );
          return;
        }

        send.mutate(
          {
            teamId,
            runId: target.runId,
            body,
            attachments,
            files,
            coAuthors,
            draftGeneration,
            answers: answering,
            startsWork: mode !== 'message',
          },
          { onError: restore },
        );
        onSent?.();
      }}
    />
  );
}
