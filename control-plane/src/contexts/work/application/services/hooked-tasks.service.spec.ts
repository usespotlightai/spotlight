import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { heardInMemory } from '@work/application/ports/heard-happenings.fake-spec';
import { HookedTasks } from '@work/application/services/hooked-tasks.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { Concerns } from '@work/domain/value-objects/concerns.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const PULL = 'https://github.com/acme/api/pull/7';

const DELIVERY = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  repositories: [
    WorkedRepository.of(Repository.of('acme/api')),
    WorkedRepository.of(Repository.of('acme/web')),
  ],
  stations: [
    Station.of({
      id: StationId.of('station_0'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
    }),
    Station.of({
      id: StationId.of('station_1'),
      key: StationKey.of('implementation'),
      name: StationName.of('Implementation'),
      position: 1,
      color: StationColor.of('#a3a8b0'),
      harness: HarnessId.of('dev'),
    }),
    Station.of({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: StationColor.of('#a3a8b0'),
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
    raisedBy: UserId.of('user_1'),
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

const hooking = (
  over: { task?: Task | null; slug?: string | null; clashes?: number } = {},
) => {
  let current = over.task === undefined ? working() : over.task;
  let clashes = over.clashes ?? 0;
  const searched: Concerns[] = [];
  const tasks = {
    find: vi.fn(async () => current),
    findByMarks: vi.fn(async (_workspace: WorkspaceId, concerns: Concerns) => {
      searched.push(concerns);
      return current;
    }),
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
    hooked: new HookedTasks(
      tasks as unknown as TaskRepository,
      { findByStation: async () => DELIVERY } as unknown as LineRepository,
      {
        slugOf: async () => (over.slug === undefined ? 'acme' : over.slug),
      } as unknown as WorkspaceReaderPort,
      heardInMemory(),
      { placementsAt: async () => [] },
      dispatch,
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => {} },
      'https://spotlight.acme.dev/',
    ),
  };
};

describe('HookedTasks', () => {
  it('says what hooks see of a task: its line and station by key, marks, repositories and link', async () => {
    const { hooked } = hooking();

    expect(await hooked.of('task_1', 'run_9')).toEqual({
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

  it('gives hooks only the reviewed repository of a review', async () => {
    const reviewing = Task.add({
      line: DELIVERY,
      at: StationId.of('station_1'),
      title: TaskTitle.of('Review the queue fix'),
      rank: TaskRank.of('i'),
      raisedBy: UserId.of('user_1'),
      now: NOW,
      newId: () => 'task_1',
    }).reviews(PullRequestUrl.of('https://github.com/acme/web/pull/9'), {
      outside: false,
    });
    const { hooked } = hooking({ task: reviewing });

    expect((await hooked.of('task_1', null))?.repositories).toEqual([
      'acme/web',
    ]);
  });

  it('names the run working the task when it is asked about none', async () => {
    const { hooked } = hooking();

    expect((await hooked.of('task_1', null))?.runId).toBe('run_1');
  });

  it('links nowhere when the workspace has no address', async () => {
    const { hooked } = hooking({ slug: null });

    expect((await hooked.of('task_1', null))?.url).toBe('');
  });

  it('knows nothing of a task that is gone', async () => {
    const { hooked } = hooking({ task: null });

    expect(await hooked.of('task_1', null)).toBeNull();
  });

  it('finds the task a pull request was opened for', async () => {
    const { hooked, searched } = hooking();

    const found = await hooked.ofPullRequest('ws_1', PULL);

    expect(found?.taskId).toBe('task_1');
    expect(searched[0]?.marks).toEqual([
      Mark.pullRequest(PullRequestUrl.of(PULL)),
    ]);
  });

  describe('noting', () => {
    it('adds what a hook says to the task, in Spotlight’s voice', async () => {
      const { hooked, current } = hooking();

      expect(
        await hooked.noted('task_1', 'Audit logged.', 'core/audit', null),
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
          station: StationName.of('Implementation'),
          body: TaskNoteBody.of('Which queue should drain first?'),
          at: NOW,
          voice: Voice.station(RUN),
        },
        RUN,
      );
      const { hooked, current } = hooking({ task: asking });

      await hooked.noted(
        'task_1',
        'Answer: the billing queue.',
        'core/audit',
        null,
      );

      const noted = current();
      expect(noted?.awaitingReview).toBe(true);
      expect(noted?.owedConversation).toEqual(asking.owedConversation);
      expect(noted?.undelivered).toEqual([]);
      expect(noted?.running).toBe(false);
      expect(noted?.notes[noted.notes.length - 1]?.kind).toBe('said');
      expect(noted?.openRemarks).toEqual([]);
    });

    it('reads the task again when it changed meanwhile', async () => {
      const { hooked, tasks } = hooking({ clashes: 1 });

      expect(
        await hooked.noted('task_1', 'Audit logged.', 'core/audit', null),
      ).toBe(true);
      expect(tasks.find).toHaveBeenCalledTimes(2);
    });

    it('notes nothing on a task that is gone', async () => {
      const { hooked } = hooking({ task: null });

      expect(
        await hooked.noted('task_1', 'Audit logged.', 'core/audit', null),
      ).toBe(false);
    });

    it('notes once however often a note is retried under one idempotency key', async () => {
      const { hooked, current } = hooking();

      await hooked.noted('task_1', 'Audit logged.', 'core/audit', 'note-1');
      await hooked.noted('task_1', 'Audit logged.', 'core/audit', 'note-1');

      expect(current()?.notes).toHaveLength(1);
    });

    it('rejects an empty note', async () => {
      const { hooked } = hooking();

      await expect(
        hooked.noted('task_1', '  ', 'core/audit', null),
      ).rejects.toThrow(InvalidTaskNoteError);
    });
  });

  describe('hearing a hook fail', () => {
    const LOOPED = {
      taskId: 'task_1',
      stationKey: 'implementation',
      hook: 'core/notify',
      code: 'loop',
      saying:
        'The hook core/notify was stopped: task.moved → the hook core/notify',
      heardAs: 'loop:firing_1',
    };

    it('moves the task where a move was deferred to, as the run it ends would, instead of asking a person', async () => {
      dispatched.length = 0;
      const deferred = working().deferMove(
        DELIVERY,
        StationId.of('station_0'),
        {
          station: StationName.of('Implementation'),
          body: TaskNoteBody.of('Changes were requested on the pull request.'),
          at: NOW,
          voice: Voice.world(),
        },
      );
      deferred.pullEvents();
      const { hooked, current } = hooking({ task: deferred });

      await expect(hooked.failed(LOOPED)).resolves.toBe('reported');

      const moved = current() as Task;
      expect(moved.stationId).toEqual(StationId.of('station_0'));
      expect(moved.running).toBe(false);
      expect(moved.awaitingReview).toBe(false);
      expect(moved.notes[1]?.kind).toBe('passed');
      expect(moved.notes[1]?.body.value).toBe(
        'Moved to Backlog when the run ended. An event arrived while the run worked.\n\nFrom the hook core/notify:\n\nThe hook core/notify was stopped: task.moved → the hook core/notify',
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
      const { hooked, current } = hooking();

      await expect(hooked.failed(LOOPED)).resolves.toBe('reported');

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
      const { hooked, current } = hooking();

      await hooked.failed(LOOPED);
      await hooked.failed({ ...LOOPED, heardAs: 'loop:firing_2' });

      expect(current()?.notes).toHaveLength(1);
      expect(current()?.notes[0]?.failure?.occurrences).toBe(2);
    });

    it('stays reported when told again for one firing after the task moved on', async () => {
      const { hooked, current, tasks } = hooking();

      await hooked.failed(LOOPED);
      const told = current() as Task;
      tasks.find.mockResolvedValue(
        told.react(DELIVERY, StationId.of('station_0'), TaskRank.of('i'), {
          station: StationName.of('Implementation'),
          body: TaskNoteBody.of('Back to the backlog.'),
          at: NOW,
          voice: Voice.station(),
        }),
      );

      await expect(hooked.failed(LOOPED)).resolves.toBe('reported');
    });

    it('counts a failure reported twice for one firing once', async () => {
      const { hooked, current } = hooking();

      await hooked.failed(LOOPED);
      await expect(hooked.failed(LOOPED)).resolves.toBe('reported');

      expect(current()?.notes[0]?.failure?.occurrences).toBe(1);
    });

    it('knows whether a task has moved on from where a hook fired', async () => {
      const { hooked } = hooking();
      const gone = hooking({ task: null });

      await expect(hooked.movedOn('task_1', 'implementation')).resolves.toBe(
        false,
      );
      await expect(hooked.movedOn('task_1', 'completed')).resolves.toBe(true);
      await expect(
        gone.hooked.movedOn('task_1', 'implementation'),
      ).resolves.toBe(true);
    });

    it('supersedes a failure on a task that has moved on from where the hook fired', async () => {
      const { hooked, tasks } = hooking();

      await expect(
        hooked.failed({ ...LOOPED, stationKey: 'review' }),
      ).resolves.toBe('superseded');
      expect(tasks.save).not.toHaveBeenCalled();
    });

    it('keeps a failure on a finished task from the inbox', async () => {
      const finished = working().moveTo(
        DELIVERY,
        StationId.of('station_2'),
        TaskRank.of('i'),
        {
          station: StationName.of('Implementation'),
          body: TaskNoteBody.of('Done.'),
          at: NOW,
          voice: Voice.station(),
        },
        { mover: UserId.of('user_1') },
      );
      const { hooked, tasks } = hooking({ task: finished });

      await expect(
        hooked.failed({ ...LOOPED, stationKey: 'completed' }),
      ).resolves.toBe('superseded');
      expect(tasks.save).not.toHaveBeenCalled();
    });

    it('tells of no failure on a task that is gone', async () => {
      const { hooked } = hooking({ task: null });

      await expect(hooked.failed(LOOPED)).resolves.toBe('gone');
    });
  });
});
