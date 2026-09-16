import { LabelTaskCommand } from '@application/commands/label-task.command';
import { LabelTaskHandler } from '@application/commands/handlers/label-task.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import { Label } from '@domain/aggregates/label.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { LabelColour } from '@domain/value-objects/label-colour.vo';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { LabelName } from '@domain/value-objects/label-name.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const team = () =>
  Team.rehydrate({
    id: TeamId.of('team_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    name: TeamName.of('Platform'),
    members: [{ userId: UserId.of('user_1'), role: TeamRole.owner }],
  });

const existingLabel = (teamId = 'team_1') =>
  Label.rehydrate({
    id: LabelId.of('label_1'),
    teamId: TeamId.of(teamId),
    name: LabelName.of('Bug'),
    colour: LabelColour.of('#e11d48'),
  });

const existingTask = (workspaceId = 'ws_1') =>
  Task.add({
    workspaceId: WorkspaceId.of(workspaceId),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const labels = (found: Label | null = existingLabel()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    forTeam: vi.fn(async () => []),
    forTask: vi.fn(async () => []),
    attachToTask: vi.fn(),
    detachFromTask: vi.fn(),
  }) satisfies LabelRepository;

const tasks = (found: Task | null = existingTask()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(async () => null),
    countsAt: vi.fn(async () => new Map()),
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

const labelTask = (
  viewerId = 'user_1',
  labelRepo = labels(),
  taskRepo = tasks(),
  teamRepo = teams(),
) =>
  new LabelTaskHandler(labelRepo, taskRepo, teamRepo).execute(
    new LabelTaskCommand('team_1', 'task_1', 'label_1', viewerId),
  );

describe('LabelTaskHandler', () => {
  it('attaches the label to the task', async () => {
    const repo = labels();
    await labelTask('user_1', repo);

    expect(repo.attachToTask).toHaveBeenCalledOnce();
  });

  it('turns away a caller not on the team', async () => {
    await expect(labelTask('outsider')).rejects.toThrow(UseCaseFault);
  });

  it('turns away when the team is not found', async () => {
    await expect(
      labelTask('user_1', labels(), tasks(), teams(null)),
    ).rejects.toThrow(UseCaseFault);
  });

  it('turns away when the label does not exist', async () => {
    await expect(labelTask('user_1', labels(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('turns away a label from a different team', async () => {
    await expect(
      labelTask('user_1', labels(existingLabel('team_other'))),
    ).rejects.toThrow(UseCaseFault);
  });

  it('turns away when the task does not exist', async () => {
    await expect(labelTask('user_1', labels(), tasks(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('turns away a task from a different workspace', async () => {
    await expect(
      labelTask('user_1', labels(), tasks(existingTask('ws_other'))),
    ).rejects.toThrow(UseCaseFault);
  });
});
