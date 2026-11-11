import type { WorkspaceRolesPort } from '@identity/application/ports/workspace-roles.port';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
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

const acme = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme'),
  slug: WorkspaceSlug.of('acme'),
  members: [
    { userId: UserId.of('owner_1'), role: WorkspaceRole.owner },
    { userId: UserId.of('admin_1'), role: WorkspaceRole.admin },
    { userId: UserId.of('member_1'), role: WorkspaceRole.member },
  ],
  version: 0,
});

const teamOf = (key: string, members: readonly string[]) =>
  Team.rehydrate({
    id: TeamId.of(`team_${key}`),
    workspaceId: acme.id,
    key: TeamKey.of(key),
    name: TeamName.of(key),
    origin: 'configuration',
    members: members.map((each) => UserId.of(each)),
    version: 0,
  });

const platform = teamOf('platform', ['member_1']);
const billing = teamOf('billing', ['owner_1']);

const accessIn = (workspace: Workspace | null) => {
  const teams = { ofWorkspace: vi.fn(async () => [platform, billing]) };

  return {
    teams,
    access: new WorkspaceAccess(
      {} as WorkspaceRolesPort,
      {
        findBySlug: vi.fn(async () => workspace),
      } as unknown as WorkspaceRepository,
      teams as unknown as TeamRepository,
    ),
  };
};

const byTeam = (found: Awaited<ReturnType<WorkspaceAccess['teamAccessIn']>>) =>
  Object.fromEntries(
    (found?.teams ?? []).map((each) => [
      each.teamId.value,
      { sees: each.sees, actsOn: each.actsOn },
    ]),
  );

describe('WorkspaceAccess.teamAccessIn', () => {
  it('finds nothing for a slug no workspace has', async () => {
    const { access, teams } = accessIn(null);

    expect(await access.teamAccessIn('acme', UserId.of('owner_1'))).toBeNull();
    expect(teams.ofWorkspace).not.toHaveBeenCalled();
  });

  it('finds nothing for a person outside the workspace', async () => {
    expect(
      await accessIn(acme).access.teamAccessIn('acme', UserId.of('stranger')),
    ).toBeNull();
  });

  it('lets a member see every team and act only on their own', async () => {
    const found = await accessIn(acme).access.teamAccessIn(
      'acme',
      UserId.of('member_1'),
    );

    expect(found?.workspaceId).toEqual(acme.id);
    expect(byTeam(found)).toEqual({
      team_platform: { sees: true, actsOn: true },
      team_billing: { sees: true, actsOn: false },
    });
  });

  it('lets an admin act on teams they are not a member of', async () => {
    expect(
      byTeam(
        await accessIn(acme).access.teamAccessIn('acme', UserId.of('admin_1')),
      ),
    ).toEqual({
      team_platform: { sees: true, actsOn: true },
      team_billing: { sees: true, actsOn: true },
    });
  });
});
