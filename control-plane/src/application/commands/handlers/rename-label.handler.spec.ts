import { RenameLabelCommand } from '@application/commands/rename-label.command';
import { RenameLabelHandler } from '@application/commands/handlers/rename-label.handler';
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

const rename = (
  name = 'Feature',
  viewerId = 'user_1',
  labelRepo = labels(),
  teamRepo = teams(),
) =>
  new RenameLabelHandler(labelRepo, teamRepo).execute(
    new RenameLabelCommand('team_1', 'label_1', name, viewerId),
  );

describe('RenameLabelHandler', () => {
  it('renames the label and returns it', async () => {
    const dto = await rename('Feature');

    expect(dto.name).toBe('Feature');
    expect(dto.id).toBe('label_1');
    expect(dto.colour).toBe('#e11d48');
  });

  it('persists the renamed label', async () => {
    const repo = labels();
    await rename('Feature', 'user_1', repo);

    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('turns away a caller not on the team', async () => {
    await expect(rename('Feature', 'outsider')).rejects.toThrow(UseCaseFault);
  });

  it('turns away when the team is not found', async () => {
    await expect(
      rename('Feature', 'user_1', labels(), teams(null)),
    ).rejects.toThrow(UseCaseFault);
  });

  it('turns away when the label does not exist', async () => {
    await expect(rename('Feature', 'user_1', labels(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('turns away a label belonging to a different team', async () => {
    const otherTeamLabel = Label.rehydrate({
      id: LabelId.of('label_1'),
      teamId: TeamId.of('team_other'),
      name: LabelName.of('Bug'),
      colour: LabelColour.of('#e11d48'),
    });

    await expect(
      rename('Feature', 'user_1', labels(otherTeamLabel)),
    ).rejects.toThrow(UseCaseFault);
  });
});
