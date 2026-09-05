import { AssignTaskCommand } from '@application/commands/assign-task.command';
import { AssignTaskHandler } from '@application/commands/handlers/assign-task.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { Task } from '@domain/aggregates/task.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { run: (work) => work() };

const team = () =>
  Team.rehydrate({
    id: TeamId.of('team_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    name: TeamName.of('Platform'),
    members: [
      { userId: UserId.of('user_1'), role: 'owner' },
      { userId: UserId.of('user_2'), role: 'member' },
    ],
  });

const task = (workspaceId = 'ws_1') =>
  Task.add({
    workspaceId: WorkspaceId.of(workspaceId),
    stationId: StationId.of('station_1'),
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
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(async () => null),
  }) satisfies TaskRepository;

const teams = (found: Team | null = team()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    named: vi.fn(async () => found),
    ofWorkspace: vi.fn(async () => (found ? [found] : [])),
    readingFrom: vi.fn(async () => []),
  }) satisfies TeamRepository;

const people: PersonReaderPort = {
  find: async (id) => ({ id: id.value, name: 'Someone', image: null }),
};

const assign = (
  assigneeId: string | null,
  viewerId = 'user_1',
  held: TaskRepository = tasks(),
  team: TeamRepository = teams(),
) =>
  new AssignTaskHandler(held, team, transaction, people).execute(
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
    const held = tasks(task().assignedTo(UserId.of('user_2')));

    const dto = await assign(null, 'user_1', held);

    expect(saved?.assignee).toBeNull();
    expect(dto.assignee).toBeNull();
  });

  it('refuses to give work to someone not on the team', async () => {
    await expect(assign('user_stranger')).rejects.toThrow(UseCaseFault);
  });

  it('turns away a viewer who is not on the team', async () => {
    await expect(assign('user_2', 'user_outsider')).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('turns away a task the team does not hold', async () => {
    await expect(
      assign('user_2', 'user_1', tasks(task('ws_other'))),
    ).rejects.toThrow(UseCaseFault);
  });
});
