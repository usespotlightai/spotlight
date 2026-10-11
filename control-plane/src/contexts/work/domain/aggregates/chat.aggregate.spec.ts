import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { InvalidSetupBranchError } from '@work/domain/exceptions/invalid-setup-branch.error';
import { NotASetupChatError } from '@work/domain/exceptions/not-a-setup-chat.error';
import { NotTheChatStarterError } from '@work/domain/exceptions/not-the-chat-starter.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ConfigHome } from '@work/domain/value-objects/config-home.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');
const LATER = new Date('2026-09-14T09:05:00.000Z');

const LEON = UserId.of('user_1');
const STRANGER = UserId.of('user_2');

const SECOND = MessagePosition.of(1);

const started = (body = 'Plan how retries back off.\nThen split it up.') =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    repositories: [Repository.of('acme/api'), Repository.of('acme/api')],
    body: ChatMessageBody.given(body),
    now: NOW,
    newId: () => 'chat_1',
  });

const improving = (stationTeam: TeamId) =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.given('Improve this station.'),
    improving: ImprovedStation.rehydrate({
      teamId: stationTeam,
      lineId: LineId.of('line_1'),
      lineKey: LineKey.of('delivery'),
      lineName: LineName.of('Delivery'),
      stationId: StationId.of('station_1'),
      stationKey: StationKey.of('implementation'),
      stationName: StationName.of('Implementation'),
    }),
    now: NOW,
    newId: () => 'chat_1',
  });

const working = () => {
  const chat = started().handedTo(RunId.of('run_1'), NOW);
  chat.pullEvents();
  return chat;
};

const proposing = () => {
  const chat = working().proposed({
    runId: RunId.of('run_1'),
    placement: ProposalPlacement.of({
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
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      startedBy: LEON,
      harness: HarnessId.of('claude-code'),
      body: ChatMessageBody.given('', [
        Attachment.of({ id: 'file_1', name: 'queue.png', size: 10 }),
      ]),
      attachments: [
        Attachment.of({ id: 'file_1', name: 'queue.png', size: 10 }),
      ],
      now: NOW,
      newId: () => 'chat_1',
    });

    expect(chat.messages[0]?.body.value).toBe('Attached queue.png.');
  });

  it('keeps each shared trace once, and names them where nothing was typed', () => {
    const retries = TraceReference.of({
      taskId: TaskId.of('task_1'),
      title: TaskTitle.of('Retries back off'),
      teamId: TeamId.of('team_1'),
    });
    const traces = [retries, retries];

    const chat = Chat.start({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      startedBy: LEON,
      harness: HarnessId.of('claude-code'),
      body: ChatMessageBody.given('', [], [retries]),
      traces,
      now: NOW,
      newId: () => 'chat_1',
    });

    expect(chat.messages[0]?.body.value).toBe(
      'Shared the trace of Retries back off.',
    );
    expect(chat.messages[0]?.traces.map((each) => each.taskId.value)).toEqual([
      'task_1',
    ]);
  });

  it('shares no trace of another team, as if there were no such task', () => {
    const elsewhere = TraceReference.of({
      taskId: TaskId.of('task_9'),
      title: TaskTitle.of('Their retries'),
      teamId: TeamId.of('team_2'),
    });

    expect(() =>
      started().said({
        by: LEON,
        body: ChatMessageBody.given('And this?'),
        traces: [elsewhere],
        at: LATER,
      }),
    ).toThrow(UnknownTaskError);
  });

  it('keeps the station it was opened to improve', () => {
    const chat = improving(TeamId.of('team_1'));

    expect(chat.improving?.stationKey.value).toBe('implementation');
    expect(chat.improving?.lineKey.value).toBe('delivery');
  });

  it('improves no station of another team, as if there were no such station', () => {
    expect(() => improving(TeamId.of('team_2'))).toThrow(UnknownStationError);
  });

  it('shares only so many traces at once', () => {
    const many = Array.from({ length: 21 }, (_, at) =>
      TraceReference.of({
        taskId: TaskId.of(`task_${at}`),
        title: TaskTitle.of('Retries'),
        teamId: TeamId.of('team_1'),
      }),
    );

    expect(() =>
      started().said({
        by: LEON,
        body: ChatMessageBody.given('All of these'),
        traces: many,
        at: LATER,
      }),
    ).toThrow(InvalidChatMessageError);
  });

  it('refuses to open with nothing at all', () => {
    expect(() => started('   ')).toThrow(InvalidChatMessageError);
  });

  it('hears only the person who started it', () => {
    expect(() =>
      working().said({
        by: STRANGER,
        body: ChatMessageBody.of('Me too.'),
        at: LATER,
      }),
    ).toThrow(NotTheChatStarterError);
  });

  it('counts what it was handed to a run with as heard', () => {
    const chat = working();

    expect(chat.running).toBe(true);
    expect(chat.undelivered).toHaveLength(0);
  });

  it('says which of its messages it handed a run', () => {
    const handed = working()
      .endedRun(RunId.of('run_1'))
      .said({ by: LEON, body: ChatMessageBody.of('And then?'), at: LATER })
      .handedTo(RunId.of('run_2'), LATER);

    const [event] = handed.pullEvents();

    expect(event).toBeInstanceOf(ChatHandedToRun);
    expect((event as ChatHandedToRun).handed.map((each) => each.value)).toEqual(
      [1],
    );
    expect(
      handed
        .messagesAt((event as ChatHandedToRun).handed)
        .map((each) => each.body.value),
    ).toEqual(['And then?']);
  });

  it('takes back only what it handed to a run that kept nothing, and wants following up', () => {
    const handed = working()
      .endedRun(RunId.of('run_1'))
      .said({ by: LEON, body: ChatMessageBody.of('Split it.'), at: LATER })
      .handedTo(RunId.of('run_2'), LATER)
      .said({ by: LEON, body: ChatMessageBody.of('And docs.'), at: LATER });

    const released = handed.runKeptNothing(RunId.of('run_2'));

    expect(released.running).toBe(false);
    expect(released.undelivered.map((each) => each.position.value)).toEqual([
      1, 2,
    ]);
    expect(released.messages[0]?.wasDeliveredTo(RunId.of('run_1'))).toBe(true);
    expect(released.wantsFollowUp).toBe(true);
  });

  it('keeps what it handed when a run it is not held by kept nothing', () => {
    const unchanged = working().runKeptNothing(RunId.of('run_2'));

    expect(unchanged.running).toBe(true);
    expect(unchanged.undelivered).toHaveLength(0);
  });

  it('counts nothing as heard by a run it is not held by', () => {
    const said = working()
      .endedRun(RunId.of('run_1'))
      .said({ by: LEON, body: ChatMessageBody.of('Split it.'), at: LATER });

    expect(
      said.deliveredUpTo(RunId.of('run_1'), SECOND, LATER).undelivered,
    ).toHaveLength(1);
  });

  it('keeps what a run heard once it started', () => {
    const heard = working()
      .said({ by: LEON, body: ChatMessageBody.of('Split it.'), at: LATER })
      .deliveredUpTo(RunId.of('run_1'), SECOND, LATER);

    expect(heard.messages[1]?.wasDeliveredTo(RunId.of('run_1'))).toBe(true);
    expect(heard.endedRun(RunId.of('run_1')).wantsFollowUp).toBe(false);
  });

  it('will not be handed to a second run while one works it', () => {
    expect(() => working().handedTo(RunId.of('run_2'), LATER)).toThrow(
      InvalidChatTransitionError,
    );
  });

  it('hears what is said while it is worked, until it is delivered', () => {
    const said = working().said({
      by: LEON,
      body: ChatMessageBody.of('Split it.'),
      at: LATER,
    });

    expect(said.undelivered.map((each) => each.position.value)).toEqual([1]);
    expect(
      said.deliveredUpTo(RunId.of('run_1'), SECOND, LATER).undelivered,
    ).toHaveLength(0);
  });

  it('answers with the model and effort the person picks, keeping the harness, and keeps them when nothing is picked', () => {
    const picked = started().said({
      by: LEON,
      body: ChatMessageBody.of('Think harder.'),
      model: HarnessModel.of('opus'),
      effort: Effort.of('high'),
      at: LATER,
    });

    expect(picked.model?.value).toBe('opus');
    expect(picked.effort?.value).toBe('high');
    expect(picked.harness.value).toBe(started().harness.value);

    const kept = picked.said({
      by: LEON,
      body: ChatMessageBody.of('And again.'),
      at: LATER,
    });
    expect(kept.model?.value).toBe('opus');

    const defaulted = kept.said({
      by: LEON,
      body: ChatMessageBody.of('Back to the default.'),
      model: null,
      effort: null,
      at: LATER,
    });
    expect(defaulted.model).toBeNull();
    expect(defaulted.effort).toBeNull();
  });

  it('wants following up only once its run is done and something is left unheard', () => {
    const said = working().said({
      by: LEON,
      body: ChatMessageBody.of('Split it.'),
      at: LATER,
    });

    expect(said.wantsFollowUp).toBe(false);
    expect(said.endedRun(RunId.of('run_1')).wantsFollowUp).toBe(true);
    expect(working().endedRun(RunId.of('run_1')).wantsFollowUp).toBe(false);
  });

  describe('when its run ends', () => {
    const SESSION = HarnessSession.of('session_1');
    const RUNNER = RunnerId.of('runner_1');
    const saidMeanwhile = () =>
      working().said({
        by: LEON,
        body: ChatMessageBody.of('Split it.'),
        at: LATER,
      });

    it('keeps the session the run worked in and follows up on what was said meanwhile', () => {
      const ended = saidMeanwhile().runEnded(RunId.of('run_1'), {
        session: SESSION,
        workedBy: RUNNER,
        stopped: false,
      });

      expect(ended.chat.running).toBe(false);
      expect(ended.chat.sessionId?.equals(SESSION)).toBe(true);
      expect(ended.followsUp).toBe(true);
    });

    it('does not follow up after a run it was asked to stop', () => {
      const ended = saidMeanwhile().runEnded(RunId.of('run_1'), {
        session: SESSION,
        workedBy: RUNNER,
        stopped: true,
      });

      expect(ended.chat.running).toBe(false);
      expect(ended.followsUp).toBe(false);
    });

    it('takes back what it handed a run that kept no session, and leaves the follow-up for later', () => {
      const ended = saidMeanwhile().runEnded(RunId.of('run_1'), {
        session: null,
        workedBy: RUNNER,
        stopped: false,
      });

      expect(ended.chat.running).toBe(false);
      expect(ended.chat.undelivered.map((each) => each.position.value)).toEqual(
        [0, 1],
      );
      expect(ended.followsUp).toBe(false);
    });

    it('stays as it is when a run it is not held by ends', () => {
      const chat = working();
      const ended = chat.runEnded(RunId.of('run_2'), {
        session: SESSION,
        workedBy: RUNNER,
        stopped: false,
      });

      expect(ended.chat).toBe(chat);
      expect(ended.followsUp).toBe(false);
    });
  });

  it('lets go of its run only for the run that works it', () => {
    const chat = working();

    expect(chat.endedRun(RunId.of('run_2')).running).toBe(true);
    expect(chat.endedRun(RunId.of('run_1')).running).toBe(false);
  });

  it('may be stopped only by the person who started it, and only while worked', () => {
    expect(working().stoppableBy(LEON).value).toBe('run_1');
    expect(() => working().stoppableBy(STRANGER)).toThrow(
      NotTheChatStarterError,
    );
    expect(() => started().stoppableBy(LEON)).toThrow(
      InvalidChatTransitionError,
    );
  });

  it('carries on in the same workspace, taking up the session it was worked in', () => {
    const plain = started().continuity();
    const worked = started()
      .workedIn(HarnessSession.of('session_1'), RunnerId.of('runner_1'))
      .continuity();

    expect(plain.key.value).toBe('chat-chat_1');
    expect(plain.sessionId).toBeNull();
    expect(worked.key.value).toBe('chat-chat_1');
    expect(worked.sessionId?.value).toBe('session_1');
  });

  it('takes a proposal only from the run working it', () => {
    expect(() =>
      started().proposed({
        runId: RunId.of('run_1'),
        placement: ProposalPlacement.of({
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
      placement: ProposalPlacement.of({
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
      NotTheChatStarterError,
    );
    expect(() => proposing().dismiss(SECOND, STRANGER, LATER)).toThrow(
      NotTheChatStarterError,
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

  describe('setting up configuration', () => {
    const settingUp = () =>
      Chat.start({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        startedBy: LEON,
        harness: HarnessId.of('claude-code'),
        repositories: [Repository.of('acme/api')],
        body: ChatMessageBody.given('Set up our configuration.'),
        setup: ConfigHome.of({ repository: 'acme/infra', folder: 'spotlight' }),
        now: NOW,
        newId: () => 'chat_1',
      }).handedTo(RunId.of('run_1'), NOW);

    const URL = PullRequestUrl.of('https://github.com/acme/infra/pull/12');

    const BRANCH = Branch.of('spotlight-configuration');

    it('reads every repository it checked out, and pushes only to the configuration’s', () => {
      const chat = settingUp();

      expect(chat.repositoryNamed('api')?.value).toBe('acme/api');
      expect(chat.pushableNamed('api')).toBeNull();
      expect(chat.pushableNamed('infra')?.value).toBe('acme/infra');
      expect(started().pushableNamed('api')).toBeNull();
    });

    it('refuses a branch named like a task’s, before anything is opened', () => {
      expect(() =>
        settingUp().mayOpenSetupFrom(
          RunId.of('run_1'),
          Branch.of('spotlight/configuration'),
        ),
      ).toThrow(InvalidSetupBranchError);
    });

    it('lets the run working it open the setup pull request, in its repository', () => {
      expect(
        settingUp().mayOpenSetupFrom(RunId.of('run_1'), BRANCH).repository
          .value,
      ).toBe('acme/infra');
      expect(() =>
        settingUp().mayOpenSetupFrom(RunId.of('run_2'), BRANCH),
      ).toThrow(InvalidChatTransitionError);
    });

    it('checks out the configuration’s repository first', () => {
      expect(settingUp().repositories.map((each) => each.value)).toEqual([
        'acme/infra',
        'acme/api',
      ]);
    });

    it('keeps the pull request its run opened', () => {
      const opened = settingUp().setupOpened(
        RunId.of('run_1'),
        BRANCH,
        URL,
        LATER,
      );

      expect(opened.setup?.pullRequest?.equals(URL)).toBe(true);
    });

    it('refuses a pull request in another repository', () => {
      expect(() =>
        settingUp().setupOpened(
          RunId.of('run_1'),
          BRANCH,
          PullRequestUrl.of('https://github.com/acme/api/pull/3'),
          LATER,
        ),
      ).toThrow(InvalidChatTransitionError);
    });

    it('refuses a run that no longer works the chat', () => {
      expect(() =>
        settingUp().setupOpened(RunId.of('run_2'), BRANCH, URL, LATER),
      ).toThrow(InvalidChatTransitionError);
    });

    it('refuses a chat that sets nothing up', () => {
      expect(() =>
        started()
          .handedTo(RunId.of('run_1'), NOW)
          .setupOpened(RunId.of('run_1'), BRANCH, URL, LATER),
      ).toThrow(NotASetupChatError);
    });

    it('keeps the first pull request, opening no second', () => {
      const once = settingUp().setupOpened(
        RunId.of('run_1'),
        BRANCH,
        URL,
        LATER,
      );
      once.pullEvents();

      const again = once.setupOpened(
        RunId.of('run_1'),
        BRANCH,
        PullRequestUrl.of('https://github.com/acme/infra/pull/13'),
        LATER,
      );

      expect(again.setup?.pullRequest?.equals(URL)).toBe(true);
      expect(again.pullEvents()).toEqual([]);
    });
  });
});
