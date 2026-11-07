import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { processedEventsInMemory } from '@work/application/ports/processed-events.fake-spec';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import { TaskNotesFromHooks } from '@work/application/services/task-notes-from-hooks.service';
import { TaskViews } from '@work/application/services/task-views.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import {
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WebTaskLinks } from '@work/infrastructure/links/web-task-links';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const PULL = 'https://github.com/acme/api/pull/7';

const DELIVERY = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  repositories: [
    repositoryOf(Repository.of('acme/api')),
    repositoryOf(Repository.of('acme/web')),
  ],
  stations: [
    stationOf({
      id: StationId.of('station_0'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: StationId.of('station_1'),
      key: StationKey.of('implementation'),
      name: StationName.of('Implementation'),
      position: 1,
      color: '#a3a8b0',
      harness: HarnessId.of('dev'),
    }),
    stationOf({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: '#a3a8b0',
      kind: 'completed',
    }),
  ],
});

const RUN = RunId.of('run_1');

const working = () =>
  Task.add({
    line: DELIVERY,
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  })
    .assignRun(RUN, DELIVERY)
    .recordPullRequest(RUN, PullRequestUrl.of(PULL), NOW, DELIVERY);

const dispatched: Task[] = [];

const dispatch: TaskDispatching = {
  runIdFor: async ({ task }) => {
    dispatched.push(task);
    return RunId.of('run_2');
  },
};

const viewing = (
  over: {
    task?: Task | null;
    slug?: string | null;
    clashes?: number;
    ambient?: readonly Mark[];
  } = {},
) => {
  let current = over.task === undefined ? working() : over.task;
  let clashes = over.clashes ?? 0;
  const searched: CorrelationKeys[] = [];
  const tasks = {
    find: vi.fn(async () => current),
    findByCorrelation: vi.fn(
      async (_workspace: WorkspaceId, correlationKeys: CorrelationKeys) => {
        searched.push(correlationKeys);
        return current ? [current] : [];
      },
    ),
    save: vi.fn(async (task: Task) => {
      if (clashes > 0) {
        clashes -= 1;
        throw new TaskVersionConflictError(task.id.value);
      }
      current = task;
    }),
  };

  return {
    tasks,
    searched,
    current: () => current,
    views: new TaskViews(
      tasks as unknown as TaskRepository,
      { findByStation: async () => DELIVERY } as unknown as LineMapsPort,
      {
        slugOf: async () => (over.slug === undefined ? 'acme' : over.slug),
      } as unknown as WorkspaceReaderPort,
      new WebTaskLinks('https://spotlight.acme.dev/'),
      { find: async () => null } as unknown as DispatchRepository,
      new IntegrationTaskViews(
        { findByStation: async () => DELIVERY } as unknown as LineMapsPort,
        { ambientOf: async () => over.ambient ?? [] },
      ),
    ),
    hooks: new TaskNotesFromHooks(
      tasks as unknown as TaskRepository,
      { findByStation: async () => DELIVERY } as unknown as LineMapsPort,
      processedEventsInMemory(),
      { placementsAt: async () => [] },
      dispatch,
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => {} },
    ),
  };
};

describe('TaskViews', () => {
  it('says what hooks see of a task: its line and station by key, marks, repositories and link', async () => {
    const { views } = viewing();

    expect(await views.of('task_1', 'run_9')).toEqual({
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      title: 'Fix the queue',
      url: 'https://spotlight.acme.dev/w/acme/team/team_1/tasks/task_1',
      line: 'delivery',
      station: 'Implementation',
      stationKey: 'implementation',
      marks: { 'git.pull-request': PULL },
      repositories: ['acme/api', 'acme/web'],
      pullRequest: PULL,
      runId: 'run_9',
    });
  });

  it('shows hooks the marks of the chat that proposed the task, under its own marks', async () => {
    const proposed = Task.add({
      line: DELIVERY,
      at: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      createdBy: UserId.of('user_1'),
      proposedIn: ProposalOrigin.of({
        chatId: ChatId.of('chat_1'),
        position: MessagePosition.of(0),
      }),
      now: NOW,
      newId: () => 'task_1',
    }).markedBy(Mark.of('slack.thread', 'own'), NOW);
    const { views } = viewing({
      task: proposed,
      ambient: [
        Mark.of('slack.channel', 'C1'),
        Mark.of('slack.thread', 'from-chat'),
      ],
    });

    expect((await views.of('task_1', null))?.marks).toEqual({
      'slack.channel': 'C1',
      'slack.thread': 'own',
    });
  });

  it('sends hooks only the reviewed repository of a review', async () => {
    const reviewing = Task.add({
      line: DELIVERY,
      at: StationId.of('station_1'),
      title: TaskTitle.of('Review the queue fix'),
      rank: TaskRank.of('i'),
      createdBy: UserId.of('user_1'),
      now: NOW,
      newId: () => 'task_1',
    }).reviews(
      PullRequestUrl.of('https://github.com/acme/web/pull/9'),
      {
        outside: false,
      },
      DELIVERY,
      new Date(0),
    );
    const { views } = viewing({ task: reviewing });

    expect((await views.of('task_1', null))?.repositories).toEqual([
      'acme/web',
    ]);
  });

  it('names the run working the task when the request names none', async () => {
    const { views } = viewing();

    expect((await views.of('task_1', null))?.runId).toBe('run_1');
  });

  it('links nowhere when the workspace has no address', async () => {
    const { views } = viewing({ slug: null });

    expect((await views.of('task_1', null))?.url).toBe('');
  });

  it('knows nothing of a task that is gone', async () => {
    const { views } = viewing({ task: null });

    expect(await views.of('task_1', null)).toBeNull();
  });

  it('finds the task a pull request was opened for', async () => {
    const { views, searched } = viewing();

    const found = await views.ofPullRequest('ws_1', PULL);

    expect(found?.taskId).toBe('task_1');
    expect(searched[0]?.marks).toEqual([
      Mark.pullRequest(PullRequestUrl.of(PULL)),
    ]);
  });

  describe('noting', () => {
    it('adds what a hook says to the task, in Spotlight’s voice', async () => {
      const { hooks, current } = viewing();

      expect(
        await hooks.noted('task_1', 'Audit logged.', 'core/audit', null),
      ).toBe(true);

      const notes = current()?.notes ?? [];
      const noted = notes[notes.length - 1];
      expect(noted?.body.value).toBe(
        'From the hook core/audit:\n\nAudit logged.',
      );
      expect(noted?.voice.isStation).toBe(true);
      expect(noted?.station.value).toBe('Implementation');
    });

    it('answers no question put to a person, and hands the agent nothing to resume on', async () => {
      const asking = working().askedAbout(
        {
          line: null,
          body: TaskNoteBody.of('Which queue should drain first?'),
          at: NOW,
          voice: Voice.station(RUN),
        },
        RUN,
      );
      const { hooks, current } = viewing({ task: asking });

      await hooks.noted(
        'task_1',
        'Answer: the billing queue.',
        'core/audit',
        null,
      );

      const noted = current();
      expect(noted?.awaitingReview).toBe(true);
      expect(noted?.pendingConversation).toEqual(asking.pendingConversation);
      expect(noted?.unacknowledged).toEqual([]);
      expect(noted?.running).toBe(false);
      expect(noted?.notes[noted.notes.length - 1]?.kind).toBe('message');
      expect(noted?.openReviewComments).toEqual([]);
    });

    it('reads the task again when it changed meanwhile', async () => {
      const { hooks, tasks } = viewing({ clashes: 1 });

      expect(
        await hooks.noted('task_1', 'Audit logged.', 'core/audit', null),
      ).toBe(true);
      expect(tasks.find).toHaveBeenCalledTimes(2);
    });

    it('notes nothing on a task that is gone', async () => {
      const { hooks } = viewing({ task: null });

      expect(
        await hooks.noted('task_1', 'Audit logged.', 'core/audit', null),
      ).toBe(false);
    });

    it('notes once however often a note is retried under one idempotency key', async () => {
      const { hooks, current } = viewing();

      await hooks.noted('task_1', 'Audit logged.', 'core/audit', 'note-1');
      await hooks.noted('task_1', 'Audit logged.', 'core/audit', 'note-1');

      expect(current()?.notes).toHaveLength(1);
    });

    it('rejects an empty note', async () => {
      const { hooks } = viewing();

      await expect(
        hooks.noted('task_1', '  ', 'core/audit', null),
      ).rejects.toThrow(InvalidTaskNoteError);
    });
  });

  describe('learning that a hook failed', () => {
    const LOOPED = {
      taskId: 'task_1',
      stationKey: 'implementation',
      hook: 'core/notify',
      code: 'loop',
      reason:
        'The hook core/notify was stopped: task.moved → the hook core/notify',
      receivedAs: 'loop:firing_1',
    };

    it('moves the task where a move was deferred to, as the run it ends would, instead of asking a person', async () => {
      dispatched.length = 0;
      const deferred = working().deferMove(
        DELIVERY,
        StationId.of('station_0'),
        {
          line: null,
          body: TaskNoteBody.of('Changes were requested on the pull request.'),
          at: NOW,
          voice: Voice.world(),
        },
      );
      deferred.pullEvents();
      const { hooks, current } = viewing({ task: deferred });

      await expect(hooks.failed(LOOPED)).resolves.toBe('reported');

      const moved = current() as Task;
      expect(moved.stationId).toEqual(StationId.of('station_0'));
      expect(moved.running).toBe(false);
      expect(moved.awaitingReview).toBe(false);
      expect(moved.notes[1]?.kind).toBe('passed');
      expect(moved.notes[1]?.body.value).toBe(
        'Moved to Backlog when the run ended. An event arrived while the run was in progress.\n\nFrom the hook core/notify:\n\nThe hook core/notify was stopped: task.moved → the hook core/notify',
      );
      expect(moved.notes[1]?.failure).toMatchObject({
        source: 'hook:core/notify',
        code: 'loop',
      });
      expect(moved.pullEvents().map((each) => each.kind)).toContain(
        'task.run-detached',
      );
      expect(dispatched).toEqual([]);
    });

    it('asks a person about the task, naming the hook and what it said', async () => {
      const { hooks, current } = viewing();

      await expect(hooks.failed(LOOPED)).resolves.toBe('reported');

      const asked = current();
      expect(asked?.awaitingReview).toBe(true);
      expect(asked?.running).toBe(false);
      expect(asked?.notes[0]?.failure).toMatchObject({
        source: 'hook:core/notify',
        code: 'loop',
        occurrences: 1,
      });
      expect(asked?.notes[0]?.body.value).toContain('task.moved → the hook');
    });

    it('counts the same failure of another firing again rather than asking twice', async () => {
      const { hooks, current } = viewing();

      await hooks.failed(LOOPED);
      await hooks.failed({ ...LOOPED, receivedAs: 'loop:firing_2' });

      expect(current()?.notes).toHaveLength(1);
      expect(current()?.notes[0]?.failure?.occurrences).toBe(2);
    });

    it('stays reported when told again for one firing after the task moved on', async () => {
      const { hooks, current, tasks } = viewing();

      await hooks.failed(LOOPED);
      const failed = current() as Task;
      tasks.find.mockResolvedValue(
        failed.react(DELIVERY, StationId.of('station_0'), TaskRank.of('i'), {
          line: null,
          body: TaskNoteBody.of('Back to the backlog.'),
          at: NOW,
          voice: Voice.station(),
        }),
      );

      await expect(hooks.failed(LOOPED)).resolves.toBe('reported');
    });

    it('counts a failure reported twice for one firing once', async () => {
      const { hooks, current } = viewing();

      await hooks.failed(LOOPED);
      await expect(hooks.failed(LOOPED)).resolves.toBe('reported');

      expect(current()?.notes[0]?.failure?.occurrences).toBe(1);
    });

    it('knows whether a task has moved on from where a hook fired', async () => {
      const { hooks } = viewing();
      const gone = viewing({ task: null });

      await expect(hooks.movedOn('task_1', 'implementation')).resolves.toBe(
        false,
      );
      await expect(hooks.movedOn('task_1', 'completed')).resolves.toBe(true);
      await expect(
        gone.hooks.movedOn('task_1', 'implementation'),
      ).resolves.toBe(true);
    });

    it('supersedes a failure on a task that has moved on from where the hook fired', async () => {
      const { hooks, tasks } = viewing();

      await expect(
        hooks.failed({ ...LOOPED, stationKey: 'review' }),
      ).resolves.toBe('superseded');
      expect(tasks.save).not.toHaveBeenCalled();
    });

    it('keeps a failure on a finished task from the inbox', async () => {
      const finished = working().moveTo(
        DELIVERY,
        StationId.of('station_2'),
        TaskRank.of('i'),
        {
          line: null,
          body: TaskNoteBody.of('Done.'),
          at: NOW,
          voice: Voice.station(),
        },
        { mover: UserId.of('user_1') },
      );
      const { hooks, tasks } = viewing({ task: finished });

      await expect(
        hooks.failed({ ...LOOPED, stationKey: 'completed' }),
      ).resolves.toBe('superseded');
      expect(tasks.save).not.toHaveBeenCalled();
    });

    it('tells of no failure on a task that is gone', async () => {
      const { hooks } = viewing({ task: null });

      await expect(hooks.failed(LOOPED)).resolves.toBe('gone');
    });
  });
});
