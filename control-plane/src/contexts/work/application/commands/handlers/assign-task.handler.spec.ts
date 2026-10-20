import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type {
  TeamDirectoryPort,
  TeamProfile,
} from '@identity/application/ports/team-directory.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AssignTaskCommand } from '@work/application/commands/assign-task.command';
import { AssignTaskHandler } from '@work/application/commands/handlers/assign-task.handler';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { RunRepository } from '@work/domain/repositories/run.repository';
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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { inTransaction: (work) => work() };

const team = (): TeamProfile => ({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: 'platform',
  name: 'Platform',
  members: [UserId.of('user_1'), UserId.of('user_2')],
});

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

const task = (workspaceId = 'ws_1') =>
  Task.add({
    line: delivery(workspaceId),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
  });

let saved: Task | undefined;

const tasks = (found: Task | null = task()) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
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

const teams = (found: TeamProfile | null = team()) =>
  ({
    find: vi.fn(async () => found),
    inWorkspace: vi.fn(async () => (found ? [found] : [])),
  }) satisfies TeamDirectoryPort;

const people: PersonReaderPort = {
  find: async (id) => ({ id: id.value, name: 'Someone', image: null }),
  findMany: async () => new Map(),
};

const assign = (
  assigneeId: string | null,
  viewerId = 'user_1',
  stored: TaskRepository = tasks(),
  team: TeamDirectoryPort = teams(),
) =>
  new AssignTaskHandler(stored, team, transaction, people, {
    findById: async () => null,
  } as unknown as RunRepository).execute(
    new AssignTaskCommand('team_1', 'task_1', assigneeId, viewerId),
  );

describe('AssignTaskHandler', () => {
  beforeEach(() => {
    saved = undefined;
  });

  it('gives a task to a team member', async () => {
    const dto = await assign('user_2');

    expect(saved?.assignee?.value).toBe('user_2');
    expect(dto.assignee?.id).toBe('user_2');
  });

  it('takes a task back to unclaimed', async () => {
    const stored = tasks(task().assign(UserId.of('user_2')));

    const dto = await assign(null, 'user_1', stored);

    expect(saved?.assignee).toBeNull();
    expect(dto.assignee).toBeNull();
  });

  it('does not give work to someone not on the team', async () => {
    await expect(assign('user_stranger')).rejects.toThrow(ApplicationError);
  });

  it('turns away a viewer who is not on the team', async () => {
    await expect(assign('user_2', 'user_outsider')).rejects.toThrow(
      ApplicationError,
    );
  });

  it('turns away a task the team does not have', async () => {
    await expect(
      assign('user_2', 'user_1', tasks(task('ws_other'))),
    ).rejects.toThrow(ApplicationError);
  });
});
