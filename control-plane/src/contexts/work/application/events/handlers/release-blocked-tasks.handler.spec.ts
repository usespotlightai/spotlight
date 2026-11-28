import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ReleaseBlockedTasks } from '@work/application/events/handlers/release-blocked-tasks.handler';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskCompleted } from '@work/domain/events/task-completed.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = new Date('2026-11-27T10:00:00.000Z');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const line = deliveryLineOf({
  harness: HarnessId.of('dev'),
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  newId: fresh,
});

const opened = (
  title: string,
  blockedBy: readonly Task[] = [],
  at = line.backlog.id,
) =>
  Task.add({
    line,
    at,
    title: TaskTitle.of(title),
    rank: TaskRank.of('i'),
    blockedBy: blockedBy.map((each) => each.id),
    now: NOW,
    newId: fresh,
  });

const stationKeyed = (key: string) => {
  const station = line.stationKeyed(StationKey.of(key));

  if (!station) {
    throw new Error(`The line has no station ${key}`);
  }

  return station;
};

const note = (body: string) => ({
  line,
  body: TaskNoteBody.of(body),
  at: NOW,
  voice: Voice.station(),
});

const completionsOf = (task: Task) =>
  task.pullEvents().filter((each) => each instanceof TaskCompleted);

const releasing = (stored: Task[], conflicts = 0) => {
  const saved: Task[] = [];
  let failing = conflicts;
  const transactions = { count: 0 };
  const tasks = partial<TaskRepository>({
    waitingFor: async (_at: WorkspaceId, blocker: TaskId) =>
      stored.filter((each) => each.waitsFor(blocker)),
    find: async (id: TaskId) =>
      stored.find((each) => each.id.equals(id)) ?? null,
    save: async (each: Task) => {
      if (failing > 0) {
        failing -= 1;
        throw new TaskVersionConflictError(each.id.value);
      }

      saved.push(each);
    },
  });

  return {
    saved,
    transactions,
    handler: new ReleaseBlockedTasks(
      tasks,
      { findByStation: async () => line },
      { placementsAt: async () => [] },
      { runIdFor: async () => RunId.of('run_1') },
      {
        inTransaction: (work) => {
          transactions.count += 1;
          return work();
        },
      },
      partial<ClockPort>({ now: () => NOW }),
    ),
  };
};

describe('ReleaseBlockedTasks', () => {
  it('starts each task that waited only for the completed one, each in a transaction of its own', async () => {
    const first = opened('Web 1/4');
    const second = opened('Web 2/4', [first]);
    const third = opened('Web 3/4', [first]);
    const { handler, saved, transactions } = releasing([first, second, third]);

    await handler.onCompleted(
      new TaskCompleted(first.id, WORKSPACE, line.completed.id, NOW),
    );

    expect(transactions.count).toBe(2);
    expect(saved.map((each) => each.stationId)).toEqual([
      line.entry?.id,
      line.entry?.id,
    ]);
    expect(saved.map((each) => each.currentRunId?.value)).toEqual([
      'run_1',
      'run_1',
    ]);
  });

  it('keeps a task waiting while the task it waits for is finished at Code Review with its pull request open, and starts it once that task is completed', async () => {
    const reviewing = opened('API 1/4', [], stationKeyed('code-review').id)
      .assignRun(RunId.of('run_api'), line)
      .finishHere(RunId.of('run_api'), line, note('Opened the pull request.'));
    const waiting = opened('Web 2/4', [reviewing]);
    const stored = [reviewing, waiting];
    const { handler, saved } = releasing(stored);

    for (const each of completionsOf(reviewing)) {
      await handler.onCompleted(each);
    }

    expect(reviewing.finished).toBe(true);
    expect(saved).toEqual([]);

    const merged = reviewing.react(
      line,
      line.completed.id,
      TaskRank.of('i'),
      note('The pull request was merged.'),
    );

    for (const each of completionsOf(merged)) {
      await handler.onCompleted(each);
    }

    expect(saved.map((each) => [each.stationId, each.blocked])).toEqual([
      [line.entry?.id, false],
    ]);
  });

  it('keeps waiting a task that still waits for another', async () => {
    const first = opened('Web 1/4');
    const other = opened('Docs');
    const second = opened('Web 2/4', [first, other]);
    const { handler, saved } = releasing([first, other, second]);

    await handler.onCompleted(
      new TaskCompleted(first.id, WORKSPACE, line.completed.id, NOW),
    );

    expect(saved.map((each) => each.stationId)).toEqual([line.backlog.id]);
    expect(saved.map((each) => each.blockedBy)).toEqual([[other.id]]);
    expect(saved.map((each) => each.currentRunId)).toEqual([null]);
  });

  it('tries again when another save came first', async () => {
    const first = opened('Web 1/4');
    const second = opened('Web 2/4', [first]);
    const { handler, saved } = releasing([first, second], 1);

    await handler.onCompleted(
      new TaskCompleted(first.id, WORKSPACE, line.completed.id, NOW),
    );

    expect(saved).toHaveLength(1);
  });

  it('starts nothing twice when the same completion comes again', async () => {
    const first = opened('Web 1/4');
    const second = opened('Web 2/4', [first]);
    const stored = [first, second];
    const { handler, saved } = releasing(stored);
    const completed = new TaskCompleted(
      first.id,
      WORKSPACE,
      line.completed.id,
      NOW,
    );

    await handler.onCompleted(completed);
    stored.splice(1, 1, ...saved);
    await handler.onCompleted(completed);

    expect(saved).toHaveLength(1);
  });

  it('leaves alone a task that was completed meanwhile', async () => {
    const first = opened('Web 1/4');
    const second = opened('Web 2/4', [first]);
    const done = second.moveTo(
      line,
      line.completed.id,
      TaskRank.of('i'),
      { line, body: TaskNoteBody.of('Done.'), at: NOW, voice: Voice.station() },
      { mover: UserId.of('user_1') },
    );
    const { handler, saved } = releasing([first, done]);

    await handler.onCompleted(
      new TaskCompleted(first.id, WORKSPACE, line.completed.id, NOW),
    );

    expect(saved).toEqual([]);
  });

  it('releases the other tasks when one cannot be saved, then says which failed', async () => {
    const first = opened('Web 1/4');
    const second = opened('Web 2/4', [first]);
    const third = opened('Web 3/4', [first]);
    const { handler, saved } = releasing([first, second, third], 3);

    await expect(
      handler.onCompleted(
        new TaskCompleted(first.id, WORKSPACE, line.completed.id, NOW),
      ),
    ).rejects.toThrow(AggregateError);
    expect(saved.map((each) => each.id)).toEqual([third.id]);
  });

  it('stops a task waiting for a deleted one, and leaves it in Backlog', async () => {
    const first = opened('Web 1/4');
    const second = opened('Web 2/4', [first]);
    const { handler, saved } = releasing([second]);

    await handler.onDeleted(new TaskDeleted(first.id, WORKSPACE));

    expect(saved.map((each) => [each.stationId, each.blocked])).toEqual([
      [line.backlog.id, false],
    ]);
  });
});
