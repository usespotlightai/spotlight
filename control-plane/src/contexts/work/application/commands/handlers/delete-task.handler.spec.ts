import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DeleteTaskCommand } from '@work/application/commands/delete-task.command';
import { DeleteTaskHandler } from '@work/application/commands/handlers/delete-task.handler';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { LineLoader } from '@work/application/services/line-loader.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const existing = () =>
  Task.add({
    line: delivery(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-28T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const tasks = (found: Task | null = existing()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    allAtStation: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    findByMarks: vi.fn(async () => null),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const access = (teamId = 'team_1') =>
  ({
    onTeam: vi.fn(async (asked: string) =>
      asked === teamId
        ? {
            teamId: TeamId.of(teamId),
            workspaceId: WorkspaceId.of('ws_1'),
            slug: 'acme',
            viewer: UserId.of('user_1'),
            administers: false,
          }
        : null,
    ),
  }) as unknown as WorkspaceAccessPort;

const lines = (teamId = 'team_1') =>
  new LineLoader(access(), {
    findByStation: vi.fn(async () => ({ teamId: TeamId.of(teamId) }) as Line),
  } as unknown as LineRepository);

describe('DeleteTaskHandler', () => {
  it('takes the task away', async () => {
    const stored = tasks();

    await new DeleteTaskHandler(stored, lines()).execute(
      new DeleteTaskCommand('team_1', 'task_1', 'user_1'),
    );

    expect(stored.remove.mock.calls[0]?.[0].id).toEqual(TaskId.of('task_1'));
  });

  it('says the task was deleted, so what others keep of it can go too', async () => {
    const stored = tasks();

    await new DeleteTaskHandler(stored, lines()).execute(
      new DeleteTaskCommand('team_1', 'task_1', 'user_1'),
    );

    const removed = stored.remove.mock.calls[0]?.[0] as Task;
    expect(removed.pullEvents().map((each) => each.kind)).toContain(
      'task.deleted',
    );
  });

  it('refuses a task that is not there', async () => {
    await expect(
      new DeleteTaskHandler(tasks(null), lines()).execute(
        new DeleteTaskCommand('team_1', 'task_missing', 'user_1'),
      ),
    ).rejects.toThrow(ApplicationError);
  });

  it('leaves nothing behind when there was nothing to take', async () => {
    const stored = tasks(null);

    await new DeleteTaskHandler(stored, lines())
      .execute(new DeleteTaskCommand('team_1', 'task_missing', 'user_1'))
      .catch(() => undefined);

    expect(stored.remove).not.toHaveBeenCalled();
  });

  it('refuses a task on another team’s line, and takes nothing away', async () => {
    const stored = tasks();

    await expect(
      new DeleteTaskHandler(stored, lines('team_2')).execute(
        new DeleteTaskCommand('team_1', 'task_1', 'user_1'),
      ),
    ).rejects.toThrow(ApplicationError);
    expect(stored.remove).not.toHaveBeenCalled();
  });
});
