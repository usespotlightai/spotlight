import { DeleteLabelCommand } from '@application/commands/delete-label.command';
import { DeleteLabelHandler } from '@application/commands/handlers/delete-label.handler';
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

const remove = (
  viewerId = 'user_1',
  labelRepo = labels(),
  teamRepo = teams(),
) =>
  new DeleteLabelHandler(labelRepo, teamRepo).execute(
    new DeleteLabelCommand('team_1', 'label_1', viewerId),
  );

describe('DeleteLabelHandler', () => {
  it('removes the label', async () => {
    const repo = labels();
    await remove('user_1', repo);

    expect(repo.remove).toHaveBeenCalledOnce();
  });

  it('turns away a caller not on the team', async () => {
    await expect(remove('outsider')).rejects.toThrow(UseCaseFault);
  });

  it('turns away when the team is not found', async () => {
    await expect(remove('user_1', labels(), teams(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('turns away when the label does not exist', async () => {
    await expect(remove('user_1', labels(null))).rejects.toThrow(UseCaseFault);
  });

  it('turns away a label belonging to a different team', async () => {
    const otherTeamLabel = Label.rehydrate({
      id: LabelId.of('label_1'),
      teamId: TeamId.of('team_other'),
      name: LabelName.of('Bug'),
      colour: LabelColour.of('#e11d48'),
    });

    await expect(remove('user_1', labels(otherTeamLabel))).rejects.toThrow(
      UseCaseFault,
    );
  });
});
