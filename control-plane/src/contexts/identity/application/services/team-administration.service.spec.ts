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

const acme = (role: WorkspaceRole = WorkspaceRole.owner, user = 'user_1') =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: role.isOwner
      ? [{ userId: UserId.of(user), role: WorkspaceRole.owner }]
      : [
          { userId: UserId.of('owner_1'), role: WorkspaceRole.owner },
          { userId: UserId.of(user), role },
        ],
    version: 0,
  });

const platform = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [UserId.of('owner_1')],
  version: 0,
});

const asking = (
  over: { workspace?: Workspace | null; team?: Team | null } = {},
) => {
  const workspaces = {
    find: vi.fn(async () =>
      over.workspace === undefined ? acme() : over.workspace,
    ),
  };

  return {
    workspaces,
    administration: new TeamAdministration(
      {
        find: vi.fn(async () =>
          over.team === undefined ? platform : over.team,
        ),
      } as unknown as TeamRepository,
      workspaces as unknown as WorkspaceRepository,
    ),
  };
};

describe('TeamAdministration', () => {
  it('hands an owner the team and its workspace to act on', async () => {
    const { administration, workspaces } = asking();
    const administered = await administration.administeredBy(
      'team_1',
      'user_1',
    );

    expect(administered?.workspace.slug.value).toBe('acme');
    expect(administered?.team).toBe(platform);
    expect(workspaces.find).toHaveBeenCalledWith(platform.workspaceId);
  });

  it('hands an admin the workspace too', async () => {
    expect(
      await asking({
        workspace: acme(WorkspaceRole.admin),
      }).administration.administeredBy('team_1', 'user_1'),
    ).not.toBeNull();
  });

  it('refuses a plain member', async () => {
    expect(
      await asking({
        workspace: acme(WorkspaceRole.member),
      }).administration.administeredBy('team_1', 'user_1'),
    ).toBeNull();
  });

  it('refuses someone who is not of the workspace at all', async () => {
    expect(
      await asking().administration.administeredBy('team_1', 'stranger'),
    ).toBeNull();
  });

  it('refuses where the team cannot be found', async () => {
    expect(
      await asking({ team: null }).administration.administeredBy(
        'team_1',
        'user_1',
      ),
    ).toBeNull();
  });

  it('refuses where the workspace cannot be found', async () => {
    expect(
      await asking({ workspace: null }).administration.administeredBy(
        'team_1',
        'user_1',
      ),
    ).toBeNull();
  });
});
