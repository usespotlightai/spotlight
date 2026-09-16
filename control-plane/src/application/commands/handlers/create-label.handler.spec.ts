import { CreateLabelCommand } from '@application/commands/create-label.command';
import { CreateLabelHandler } from '@application/commands/handlers/create-label.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { Label } from '@domain/aggregates/label.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
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

const labels = (found: Label | null = null) =>
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

const teams = (found: Team | null = team()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    named: vi.fn(async () => found),
    ofWorkspace: vi.fn(async () => (found ? [found] : [])),
    readingFrom: vi.fn(async () => []),
  }) satisfies TeamRepository;

const ids: IdGeneratorPort = { generate: () => 'label_new' };

const create = (
  name = 'Bug',
  colour = '#e11d48',
  viewerId = 'user_1',
  labelRepo = labels(),
  teamRepo = teams(),
) =>
  new CreateLabelHandler(labelRepo, teamRepo, ids).execute(
    new CreateLabelCommand('team_1', name, colour, viewerId),
  );

describe('CreateLabelHandler', () => {
  it('creates a label and returns it', async () => {
    const dto = await create();

    expect(dto.id).toBe('label_new');
    expect(dto.teamId).toBe('team_1');
    expect(dto.name).toBe('Bug');
    expect(dto.colour).toBe('#e11d48');
  });

  it('persists the new label', async () => {
    const repo = labels();
    await create('Bug', '#e11d48', 'user_1', repo);

    expect(repo.add).toHaveBeenCalledOnce();
  });

  it('turns away a caller not on the team', async () => {
    await expect(create('Bug', '#e11d48', 'outsider')).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('turns away when the team is not found', async () => {
    await expect(
      create('Bug', '#e11d48', 'user_1', labels(), teams(null)),
    ).rejects.toThrow(UseCaseFault);
  });

  it('rejects an invalid colour', async () => {
    await expect(create('Bug', 'not-a-colour')).rejects.toThrow(UseCaseFault);
  });

  it('rejects a name that is too long', async () => {
    await expect(create('x'.repeat(51))).rejects.toThrow(UseCaseFault);
  });
});
