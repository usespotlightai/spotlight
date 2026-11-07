import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DeleteTaskCommand } from '@work/application/commands/delete-task.command';
import { DeleteTaskHandler } from '@work/application/commands/handlers/delete-task.handler';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { LineLoader } from '@work/application/services/line-loader.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

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

const existing = () =>
  Task.add({
    line: delivery(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: new Date('2026-08-28T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const tasks = (found: Task | null = existing()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    placementsAt: vi.fn(async () => []),
    findByCorrelation: vi.fn(async () => []),
    holdingMark: vi.fn(async () => []),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    withTurnAnsweredBetween: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const access = (teamId = 'team_1') =>
  ({
    inWorkspaceOfTeam: vi.fn(async (requested: TeamId) =>
      requested.value === teamId
        ? {
            teamId: requested,
            workspaceId: WorkspaceId.of('ws_1'),
            slug: 'acme',
            viewer: UserId.of('user_1'),
            isAdmin: false,
          }
        : null,
    ),
  }) as unknown as WorkspaceAccessPort;

const lines = (teamId = 'team_1') =>
  new LineLoader(access(), {
    findByStation: vi.fn(
      async () => ({ teamId: TeamId.of(teamId) }) as LineMap,
    ),
  } as unknown as LineMapsPort);

const inOneTransaction = () => {
  const transaction = {
    open: false,
    async inTransaction<T>(work: () => Promise<T>): Promise<T> {
      transaction.open = true;
      try {
        return await work();
      } finally {
        transaction.open = false;
      }
    },
  };

  return transaction;
};

describe('DeleteTaskHandler', () => {
  it('finds and removes the task in one transaction, so a change between the two is not lost', async () => {
    const transaction = inOneTransaction();
    const seen: boolean[] = [];
    const stored = tasks();
    stored.find.mockImplementation(async () => {
      seen.push(transaction.open);
      return existing();
    });
    stored.remove.mockImplementation(async () => {
      seen.push(transaction.open);
    });

    await new DeleteTaskHandler(stored, lines(), transaction).execute(
      new DeleteTaskCommand('team_1', 'task_1', 'user_1'),
    );

    expect(seen).toEqual([true, true]);
  });

  it('takes the task away', async () => {
    const stored = tasks();

    await new DeleteTaskHandler(stored, lines(), inOneTransaction()).execute(
      new DeleteTaskCommand('team_1', 'task_1', 'user_1'),
    );

    expect(stored.remove.mock.calls[0]?.[0].id).toEqual(TaskId.of('task_1'));
  });

  it('says the task was deleted, so what others store of it can go too', async () => {
    const stored = tasks();

    await new DeleteTaskHandler(stored, lines(), inOneTransaction()).execute(
      new DeleteTaskCommand('team_1', 'task_1', 'user_1'),
    );

    const removed = stored.remove.mock.calls[0]?.[0] as Task;
    expect(removed.pullEvents().map((each) => each.kind)).toContain(
      'task.deleted',
    );
  });

  it('rejects a task that is not there', async () => {
    await expect(
      new DeleteTaskHandler(tasks(null), lines(), inOneTransaction()).execute(
        new DeleteTaskCommand('team_1', 'task_missing', 'user_1'),
      ),
    ).rejects.toThrow(ApplicationError);
  });

  it('leaves nothing behind when there was nothing to take', async () => {
    const stored = tasks(null);

    await new DeleteTaskHandler(stored, lines(), inOneTransaction())
      .execute(new DeleteTaskCommand('team_1', 'task_missing', 'user_1'))
      .catch(() => undefined);

    expect(stored.remove).not.toHaveBeenCalled();
  });

  it('rejects a task on another team’s line, and takes nothing away', async () => {
    const stored = tasks();

    await expect(
      new DeleteTaskHandler(
        stored,
        lines('team_2'),
        inOneTransaction(),
      ).execute(new DeleteTaskCommand('team_1', 'task_1', 'user_1')),
    ).rejects.toThrow(ApplicationError);
    expect(stored.remove).not.toHaveBeenCalled();
  });
});
