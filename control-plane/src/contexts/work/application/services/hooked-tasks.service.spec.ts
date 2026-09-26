import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { HookedTasks } from '@work/application/services/hooked-tasks.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import { TaskMovedOnError } from '@work/domain/exceptions/task-moved-on.error';
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
    .handedTo(RUN, DELIVERY)
    .openedAt(RUN, PullRequestUrl.of(PULL));

const hooking = (
  over: { task?: Task | null; slug?: string | null; clashes?: number } = {},
) => {
  let standing = over.task === undefined ? working() : over.task;
  let clashes = over.clashes ?? 0;
  const held: Concerns[] = [];
  const tasks = {
    find: vi.fn(async () => standing),
    holding: vi.fn(async (_workspace: WorkspaceId, concerns: Concerns) => {
      held.push(concerns);
      return standing;
    }),
    save: vi.fn(async (task: Task) => {
      if (clashes > 0) {
        clashes -= 1;
        throw new TaskMovedOnError(task.id.value);
      }
      standing = task;
    }),
  };

  return {
    tasks,
    held,
    standing: () => standing,
    hooked: new HookedTasks(
      tasks as unknown as TaskRepository,
      { holding: async () => DELIVERY } as unknown as LineRepository,
      {
        slugOf: async () => (over.slug === undefined ? 'acme' : over.slug),
      } as unknown as WorkspaceReaderPort,
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
    const { hooked, held } = hooking();

    const found = await hooked.ofPullRequest('ws_1', PULL);

    expect(found?.taskId).toBe('task_1');
    expect(held[0]?.marks).toEqual([Mark.pullRequest(PullRequestUrl.of(PULL))]);
  });

  describe('noting', () => {
    it('adds what a hook says to the task, in Spotlight’s voice', async () => {
      const { hooked, standing } = hooking();

      expect(await hooked.noted('task_1', 'Audit logged.', 'core/audit')).toBe(
        true,
      );

      const notes = standing()?.notes ?? [];
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
      const { hooked, standing } = hooking({ task: asking });

      await hooked.noted('task_1', 'Answer: the billing queue.', 'core/audit');

      const noted = standing();
      expect(noted?.awaitingReview).toBe(true);
      expect(noted?.owedConversation).toEqual(asking.owedConversation);
      expect(noted?.undelivered).toEqual([]);
      expect(noted?.running).toBe(false);
      expect(noted?.notes[noted.notes.length - 1]?.kind).toBe('said');
      expect(noted?.openRemarks).toEqual([]);
    });

    it('reads the task again when it moved on meanwhile', async () => {
      const { hooked, tasks } = hooking({ clashes: 1 });

      expect(await hooked.noted('task_1', 'Audit logged.', 'core/audit')).toBe(
        true,
      );
      expect(tasks.find).toHaveBeenCalledTimes(2);
    });

    it('notes nothing on a task that is gone', async () => {
      const { hooked } = hooking({ task: null });

      expect(await hooked.noted('task_1', 'Audit logged.', 'core/audit')).toBe(
        false,
      );
    });

    it('refuses to note nothing', async () => {
      const { hooked } = hooking();

      await expect(hooked.noted('task_1', '  ', 'core/audit')).rejects.toThrow(
        InvalidTaskNoteError,
      );
    });
  });
});
