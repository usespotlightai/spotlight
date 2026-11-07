import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ReleaseTakenMarks } from '@work/application/events/handlers/release-taken-marks.handler';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskMarked } from '@work/domain/events/task-marked.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const STATION = StationId.of('station_1');
const THREAD = Mark.of('slack.thread', '170.9');

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const taskAt = (id: string, markedAt: Date | null): Task => {
  const added = Task.add({
    line: delivery(WORKSPACE.value, STATION.value),
    at: STATION,
    title: TaskTitle.of(`Task ${id}`),
    rank: TaskRank.of('m'),
    now: new Date('2026-09-17T08:00:00.000Z'),
    newId: () => id,
  });
  const marked = markedAt ? added.markedBy(THREAD, markedAt) : added;
  marked.pullEvents();

  return marked;
};

const releasing = (holders: readonly Task[]) => {
  const stored = new Map(holders.map((each) => [each.id.value, each]));
  const saved: Task[] = [];
  const tasks = {
    holdingMark: vi.fn(async () => [...stored.values()]),
    find: vi.fn(async (id: TaskId) => stored.get(id.value) ?? null),
    save: vi.fn(async (each: Task) => {
      saved.push(each);
      stored.set(each.id.value, each);
    }),
  } as unknown as TaskRepository;

  return {
    saved,
    handler: new ReleaseTakenMarks(tasks, {
      inTransaction: (work) => work(),
    }),
  };
};

describe('ReleaseTakenMarks', () => {
  it('releases the mark from every task that took it before the newest holder', async () => {
    const older = taskAt('task_0', new Date('2026-09-17T09:00:00.000Z'));
    const newer = taskAt('task_1', new Date('2026-09-17T10:00:00.000Z'));
    const { handler, saved } = releasing([older, newer]);

    await handler.on(new TaskMarked(newer.id, WORKSPACE, THREAD));

    expect(saved.map((each) => each.id.value)).toEqual(['task_0']);
    expect(saved[0]?.marks).toEqual([]);
  });

  it('leaves the newest holder alone when an older marking is heard late', async () => {
    const older = taskAt('task_0', new Date('2026-09-17T09:00:00.000Z'));
    const newer = taskAt('task_1', new Date('2026-09-17T10:00:00.000Z'));
    const { handler, saved } = releasing([older, newer]);

    await handler.on(new TaskMarked(older.id, WORKSPACE, THREAD));

    expect(saved.map((each) => each.id.value)).toEqual(['task_0']);
    expect(saved[0]?.marks).toEqual([]);
  });

  it('writes nothing where only one task holds the mark', async () => {
    const only = taskAt('task_0', new Date('2026-09-17T09:00:00.000Z'));
    const { handler, saved } = releasing([only]);

    await handler.on(new TaskMarked(only.id, WORKSPACE, THREAD));

    expect(saved).toEqual([]);
  });
});
