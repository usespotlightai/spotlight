import { Chat } from '@domain/aggregates/chat.aggregate';
import { ChatStarted } from '@domain/events/chat-started.event';
import { ProposalAccepted } from '@domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@domain/events/proposal-dismissed.event';
import { TaskProposed } from '@domain/events/task-proposed.event';
import { InvalidChatMessageError } from '@domain/exceptions/invalid-chat-message.error';
import { InvalidChatTransitionError } from '@domain/exceptions/invalid-chat-transition.error';
import { UnknownChatError } from '@domain/exceptions/unknown-chat.error';
import { Attachment } from '@domain/value-objects/attachment.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { MessagePosition } from '@domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@domain/value-objects/proposal-placement.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');
const LATER = new Date('2026-09-14T09:05:00.000Z');

const LEON = UserId.of('user_1');
const STRANGER = UserId.of('user_2');

const SECOND = MessagePosition.of(1);

const started = (body = 'Plan how retries back off.\nThen split it up.') =>
  Chat.start({
    id: 'chat_1',
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    repositories: [Repository.of('acme/api'), Repository.of('acme/api')],
    body,
    now: NOW,
  });

const working = () => {
  const chat = started().handedTo(RunId.of('run_1'), NOW);
  chat.pullEvents();
  return chat;
};

const proposing = () => {
  const chat = working().proposed({
    runId: RunId.of('run_1'),
    placement: ProposalPlacement.rehydrate({
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    }),
    title: TaskTitle.of('Back off exponentially'),
    description: null,
    at: LATER,
  });
  chat.pullEvents();
  return chat;
};

describe('Chat', () => {
  it('is named by the first line of what opened it, and says it started', () => {
    const chat = started();

    expect(chat.title.value).toBe('Plan how retries back off.');
    expect(chat.pullEvents()).toEqual([expect.any(ChatStarted)]);
  });

  it('keeps each repository once', () => {
    expect(started().repositories.map((each) => each.value)).toEqual([
      'acme/api',
    ]);
  });

  it('opens with what the person said, waiting to be heard', () => {
    const chat = started();

    expect(chat.messages).toHaveLength(1);
    expect(chat.undelivered.map((each) => each.position.value)).toEqual([0]);
  });

  it('names an attachment where nothing was typed', () => {
    const chat = Chat.start({
      id: 'chat_1',
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      startedBy: LEON,
      harness: HarnessId.of('claude-code'),
      body: '',
      attachments: [
        Attachment.of({ id: 'file_1', name: 'queue.png', size: 10 }),
      ],
      now: NOW,
    });

    expect(chat.messages[0]?.body.value).toBe('Attached queue.png.');
  });

  it('refuses to open with nothing at all', () => {
    expect(() => started('   ')).toThrow(InvalidChatMessageError);
  });

  it('hears only the person who started it', () => {
    expect(() =>
      working().said({ by: STRANGER, body: 'Me too.', at: LATER }),
    ).toThrow(UnknownChatError);
  });

  it('counts what it was handed to a run with as heard', () => {
    const chat = working();

    expect(chat.running).toBe(true);
    expect(chat.undelivered).toHaveLength(0);
  });

  it('will not be handed to a second run while one works it', () => {
    expect(() => working().handedTo(RunId.of('run_2'), LATER)).toThrow(
      InvalidChatTransitionError,
    );
  });

  it('hears what is said while it is worked, until it is delivered', () => {
    const said = working().said({ by: LEON, body: 'Split it.', at: LATER });

    expect(said.undelivered.map((each) => each.position.value)).toEqual([1]);
    expect(said.deliveredUpTo(SECOND, LATER).undelivered).toHaveLength(0);
  });

  it('lets go of its run only for the run that works it', () => {
    const chat = working();

    expect(chat.endedRun(RunId.of('run_2')).running).toBe(true);
    expect(chat.endedRun(RunId.of('run_1')).running).toBe(false);
  });

  it('may be stopped only by the person who started it, and only while worked', () => {
    expect(working().stoppableBy(LEON).value).toBe('run_1');
    expect(() => working().stoppableBy(STRANGER)).toThrow(UnknownChatError);
    expect(() => started().stoppableBy(LEON)).toThrow(
      InvalidChatTransitionError,
    );
  });

  it('carries on in the same workspace, on the runner that holds its session', () => {
    const plain = started().continuity();
    const worked = started()
      .workedIn(HarnessSession.of('session_1'), RunnerId.of('runner_1'))
      .continuity();

    expect(plain.key).toBe('chat-chat_1');
    expect(plain.pinnedTo).toBeNull();
    expect(worked.sessionId?.value).toBe('session_1');
    expect(worked.pinnedTo?.value).toBe('runner_1');
  });

  it('takes a proposal only from the run working it', () => {
    expect(() =>
      started().proposed({
        runId: RunId.of('run_1'),
        placement: ProposalPlacement.rehydrate({
          lineId: LineId.of('line_1'),
          stationId: StationId.of('station_1'),
        }),
        title: TaskTitle.of('Back off exponentially'),
        description: null,
        at: LATER,
      }),
    ).toThrow(InvalidChatTransitionError);
  });

  it('holds a proposal open, says it was proposed, and never delivers it back', () => {
    const chat = working().proposed({
      runId: RunId.of('run_1'),
      placement: ProposalPlacement.rehydrate({
        lineId: LineId.of('line_1'),
        stationId: StationId.of('station_1'),
      }),
      title: TaskTitle.of('Back off exponentially'),
      description: null,
      at: LATER,
    });

    expect(chat.proposalAt(SECOND).isOpen).toBe(true);
    expect(chat.messages[1]?.kind).toBe('proposed');
    expect(chat.undelivered).toHaveLength(0);
    expect(chat.pullEvents()).toEqual([expect.any(TaskProposed)]);
  });

  it('accepts a proposal for the person who started it, saying what to create', () => {
    const accepted = proposing().accept(SECOND, LEON, LATER);
    const [event] = accepted.pullEvents();

    expect(accepted.proposalAt(SECOND).state).toBe('accepted');
    expect(event).toBeInstanceOf(ProposalAccepted);
    expect((event as ProposalAccepted).title.value).toBe(
      'Back off exponentially',
    );
    expect((event as ProposalAccepted).acceptedBy.equals(LEON)).toBe(true);
  });

  it('lets nobody else accept or dismiss a proposal', () => {
    expect(() => proposing().accept(SECOND, STRANGER, LATER)).toThrow(
      UnknownChatError,
    );
    expect(() => proposing().dismiss(SECOND, STRANGER, LATER)).toThrow(
      UnknownChatError,
    );
  });

  it('remembers the task an accepted proposal became', () => {
    const created = proposing()
      .accept(SECOND, LEON, LATER)
      .proposalBecame(SECOND, TaskId.of('task_1'), LATER);

    expect(created.proposalAt(SECOND).state).toBe('created');
    expect(created.proposalAt(SECOND).taskId?.value).toBe('task_1');
  });

  it('opens a proposal again where its task could not be created', () => {
    const reopened = proposing()
      .accept(SECOND, LEON, LATER)
      .acceptanceFailed(SECOND);

    expect(reopened.proposalAt(SECOND).isOpen).toBe(true);
  });

  it('dismisses a proposal once, saying so', () => {
    const dismissed = proposing().dismiss(SECOND, LEON, LATER);

    expect(dismissed.proposalAt(SECOND).state).toBe('dismissed');
    expect(dismissed.pullEvents()).toEqual([expect.any(ProposalDismissed)]);
    expect(() => dismissed.accept(SECOND, LEON, LATER)).toThrow(
      InvalidChatTransitionError,
    );
  });

  it('never creates a task from a proposal nobody accepted', () => {
    expect(() =>
      proposing().proposalBecame(SECOND, TaskId.of('task_1'), LATER),
    ).toThrow(InvalidChatTransitionError);
  });

  it('has no proposal where something was only said', () => {
    expect(() => proposing().proposalAt(MessagePosition.of(0))).toThrow(
      InvalidChatTransitionError,
    );
  });
});
