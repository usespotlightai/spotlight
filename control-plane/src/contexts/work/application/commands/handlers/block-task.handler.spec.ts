import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { BlockTaskCommand } from '@work/application/commands/block-task.command';
import { BlockTaskHandler } from '@work/application/commands/handlers/block-task.handler';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { SeenBlockers } from '@work/application/services/seen-blockers';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { BlockingGraph } from '@work/domain/services/blocking-graph';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T10:00:00.000Z');
const transaction: TransactionPort = { inTransaction: (work) => work() };

const lineOf = (team: string, backlog: string) =>
  lineMapOf({
    id: LineId.of(`line_${team}`),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of(team),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of(backlog),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of(`${backlog}_completed`),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const OURS = lineOf('team_1', 'station_ours');
const THEIRS = lineOf('team_2', 'station_theirs');

const opened = (id: string, line: LineMap) =>
  Task.add({
    line,
    at: line.backlog.id,
    title: TaskTitle.of(id),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => id,
  });

const blocking = (stored: readonly Task[]) => {
  const saved: Task[] = [];
  const tasks = partial<TaskRepository>({
    find: async (id: TaskId) =>
      stored.find((each) => each.id.equals(id)) ?? null,
    blockingIn: async () => BlockingGraph.empty(),
    save: async (each: Task) => {
      saved.push(each);
    },
  });
  const lines = {
    findByStation: async (at: StationId) =>
      [OURS, THEIRS].find((each) => each.stationAt(at) !== null) ?? null,
  };
  const access = workAccessSeeing((teamId) => teamId.value === 'team_1');

  return {
    saved,
    handler: new BlockTaskHandler(
      tasks,
      access,
      transaction,
      partial<LineMapsPort>(lines),
      new SeenBlockers(tasks, lines, access),
    ),
  };
};

describe('BlockTaskHandler', () => {
  it('saves the tasks a task waits for', async () => {
    const first = opened('task_1', OURS);
    const second = opened('task_2', OURS);
    const { handler, saved } = blocking([first, second]);

    await handler.execute(
      new BlockTaskCommand('team_1', 'task_2', ['task_1'], 'user_1'),
    );

    expect(saved.map((each) => each.blockedBy)).toEqual([[first.id]]);
  });

  it('does not let a task wait for one on a team the person does not see', async () => {
    const theirs = opened('task_9', THEIRS);
    const second = opened('task_2', OURS);
    const { handler, saved } = blocking([theirs, second]);

    await expect(
      handler.execute(
        new BlockTaskCommand('team_1', 'task_2', ['task_9'], 'user_1'),
      ),
    ).rejects.toThrow(ApplicationError);
    expect(saved).toEqual([]);
  });

  it('does not know a blocking task that does not exist', async () => {
    const { handler } = blocking([opened('task_2', OURS)]);

    await expect(
      handler.execute(
        new BlockTaskCommand('team_1', 'task_2', ['task_gone'], 'user_1'),
      ),
    ).rejects.toThrow('Task task_gone not found.');
  });
});
