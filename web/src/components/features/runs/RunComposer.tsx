import { FixedAgent } from '@/components/features/stations/FixedAgent';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { useSendMessage, useSendTaskMessage } from '@/hooks/api/useSendMessage';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useSharedDraft } from '@/hooks/useSharedDraft';
import { LINE_SETS_REPOSITORIES, type YourMessage } from '@/lib/run';

type Target =
  | { runId: string; taskId: string | undefined }
  | { runId: null; taskId: string };

type RunComposerProps = Target & {
  slug: string;
  teamId: string;
  station: string;
  stoppable: boolean;
  yourMessage: YourMessage;
  onSent?: () => void;
};

type Mode = 'answering' | 'driving' | 'holds' | 'restarts' | 'kept' | 'message';

const MODES: Partial<Record<YourMessage, Mode>> = {
  answer: 'answering',
  drives: 'driving',
  holds: 'holds',
  reopens: 'restarts',
  'waits-for-chat': 'kept',
};

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
  answering: 'Reply to continue the run…',
  driving: 'Tell the agent what to do next…',
  holds: 'Your message puts the task on hold…',
  restarts: 'Say what to change…',
  kept: 'Your message goes to the agent chat that holds the task…',
  message: WRITE_A_MESSAGE,
};

const placeholderFor = (mode: Mode, stoppable: boolean): string =>
  mode === 'holds' && stoppable
    ? 'Your message stops the run and puts the task on hold…'
    : PLACEHOLDERS[mode];

export function RunComposer({
  slug,
  teamId,
  station,
  stoppable,
  yourMessage,
  onSent,
  ...target
}: RunComposerProps) {
  const { runId, taskId } = target;
  const send = useSendMessage();
  const sendToTask = useSendTaskMessage();
  const stop = useStopRun();
  const { line, station: currentStation } = useTaskStation(teamId, taskId);
  const answering = yourMessage === 'answer';
  const mode = MODES[yourMessage] ?? 'message';
  const shared = useSharedDraft(taskId);

  return (
    <ChatInput
      slug={slug}
      label={labelFor(mode, station)}
      placeholder={placeholderFor(mode, stoppable)}
      pending={send.isPending || sendToTask.isPending}
      running={stoppable}
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
            startsWork: mode !== 'message' && mode !== 'kept',
          },
          { onError: restore },
        );
        onSent?.();
      }}
    />
  );
}
