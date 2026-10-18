import { AddTeamMemberCommand } from '@identity/application/commands/add-team-member.command';
import { AddTeamMemberHandler } from '@identity/application/commands/handlers/add-team-member.handler';
import { TeamAdministration } from '@identity/application/services/team-administration.service';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const LEON = UserId.of('user_leon');
const ADA = UserId.of('user_ada');
const BEA = UserId.of('user_bea');

const workspace = (leonIs: WorkspaceRole) =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [
      { userId: UserId.of('user_owner'), role: WorkspaceRole.owner },
      { userId: LEON, role: leonIs },
      { userId: ADA, role: WorkspaceRole.member },
      { userId: BEA, role: WorkspaceRole.member },
    ],
    version: 0,
  });

const platform = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [LEON, BEA],
  version: 0,
});

const adding = (leonIs = WorkspaceRole.admin) => {
  const save = vi.fn(async (_: Team) => {});
  const teams = {
    find: async () => platform,
    save,
  } as unknown as TeamRepository;

  const handler = new AddTeamMemberHandler(
    new TeamAdministration(teams, {
      find: async () => workspace(leonIs),
    } as unknown as WorkspaceRepository),
    teams,
  );

  return { handler, save };
};

const add = (userId: string) =>
  new AddTeamMemberCommand('team_1', userId, 'user_leon');

describe('AddTeamMemberHandler', () => {
  it('puts somebody in the workspace on the team, and says so', async () => {
    const { handler, save } = adding();

    await expect(handler.execute(add('user_ada'))).resolves.toBe(true);

    const saved = save.mock.calls[0]?.[0];
    expect(saved?.hasMember(ADA)).toBe(true);
    expect(saved?.pullEvents().map((each) => each.kind)).toEqual([
      'team.member-joined',
    ]);
  });

  it('rejects somebody already on the team', async () => {
    const { handler, save } = adding();

    await expect(handler.execute(add('user_bea'))).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Platform already includes this person.',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects somebody outside the workspace', async () => {
    const { handler, save } = adding();

    await expect(handler.execute(add('user_stranger'))).rejects.toMatchObject({
      kind: 'invalid',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing to somebody who may not administer the team', async () => {
    const { handler, save } = adding(WorkspaceRole.member);

    await expect(handler.execute(add('user_ada'))).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
