import { RecolourLabelCommand } from '@application/commands/recolour-label.command';
import { RecolourLabelHandler } from '@application/commands/handlers/recolour-label.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import { Label } from '@domain/aggregates/label.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { LabelColour } from '@domain/value-objects/label-colour.vo';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { LabelName } from '@domain/value-objects/label-name.vo';
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

const existingLabel = () =>
  Label.rehydrate({
    id: LabelId.of('label_1'),
    teamId: TeamId.of('team_1'),
    name: LabelName.of('Bug'),
    colour: LabelColour.of('#e11d48'),
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

const teams = (found: Team | null = team()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    named: vi.fn(async () => found),
    ofWorkspace: vi.fn(async () => (found ? [found] : [])),
    readingFrom: vi.fn(async () => []),
  }) satisfies TeamRepository;

const recolour = (
  colour = '#7c3aed',
  viewerId = 'user_1',
  labelRepo = labels(),
  teamRepo = teams(),
) =>
  new RecolourLabelHandler(labelRepo, teamRepo).execute(
    new RecolourLabelCommand('team_1', 'label_1', colour, viewerId),
  );

describe('RecolourLabelHandler', () => {
  it('recolours the label and returns it', async () => {
    const dto = await recolour('#7c3aed');

    expect(dto.colour).toBe('#7c3aed');
    expect(dto.id).toBe('label_1');
    expect(dto.name).toBe('Bug');
  });

  it('persists the recoloured label', async () => {
    const repo = labels();
    await recolour('#7c3aed', 'user_1', repo);

    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('turns away a caller not on the team', async () => {
    await expect(recolour('#7c3aed', 'outsider')).rejects.toThrow(UseCaseFault);
  });

  it('turns away when the team is not found', async () => {
    await expect(
      recolour('#7c3aed', 'user_1', labels(), teams(null)),
    ).rejects.toThrow(UseCaseFault);
  });

  it('turns away when the label does not exist', async () => {
    await expect(recolour('#7c3aed', 'user_1', labels(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('rejects an invalid colour', async () => {
    await expect(recolour('not-a-colour')).rejects.toThrow(UseCaseFault);
  });
});
