import type { WorkspaceRolesPort } from '@identity/application/ports/workspace-roles.port';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { IssuedTokenGrant } from '@identity/domain/value-objects/issued-token-grant.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const acme = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme'),
  slug: WorkspaceSlug.of('acme'),
  members: [
    {
      userId: UserId.of('owner_1'),
      role: WorkspaceRole.owner,
      suspendedAt: null,
    },
    {
      userId: UserId.of('admin_1'),
      role: WorkspaceRole.admin,
      suspendedAt: null,
    },
    {
      userId: UserId.of('member_1'),
      role: WorkspaceRole.member,
      suspendedAt: null,
    },
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
  const teams = {
    ofWorkspace: vi.fn(() => Promise.resolve([platform, billing])),
    find: vi.fn((id: TeamId) =>
      Promise.resolve(
        [platform, billing].find((each) => each.id.equals(id)) ?? null,
      ),
    ),
  };

  return {
    teams,
    access: new WorkspaceAccess(
      partial<WorkspaceRolesPort>({}),
      partial<WorkspaceRepository>({
        findBySlug: vi.fn(() => Promise.resolve(workspace)),
        find: vi.fn(() => Promise.resolve(workspace)),
      }),
      partial<TeamRepository>(teams),
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

describe('WorkspaceAccess.teamAccessOfMembers', () => {
  it('finds no one in a workspace that does not exist', async () => {
    expect(
      await accessIn(null).access.teamAccessOfMembers(WorkspaceId.of('ws_1')),
    ).toEqual([]);
  });

  it('gives each member the same team access as their own inbox', async () => {
    const { access } = accessIn(acme);
    const members = await access.teamAccessOfMembers(acme.id);

    expect(
      Object.fromEntries(
        members.map((each) => [each.viewer.value, byTeam(each)]),
      ),
    ).toEqual({
      owner_1: byTeam(await access.teamAccessIn('acme', UserId.of('owner_1'))),
      admin_1: {
        team_platform: { sees: true, actsOn: true },
        team_billing: { sees: true, actsOn: true },
      },
      member_1: {
        team_platform: { sees: true, actsOn: true },
        team_billing: { sees: true, actsOn: false },
      },
    });
  });
});

describe('WorkspaceAccess.accessOnTeam', () => {
  const on = (team: TeamId, person: string) =>
    accessIn(acme).access.accessOnTeam(
      team,
      PersonPrincipal.of(UserId.of(person)),
    );

  it('says a member acts on their own team and joined it', async () => {
    expect(await on(platform.id, 'member_1')).toEqual({
      actsOn: true,
      joined: true,
    });
  });

  it('says an admin acts on a team they did not join', async () => {
    expect(await on(platform.id, 'admin_1')).toEqual({
      actsOn: true,
      joined: false,
    });
  });

  it('says a member neither acts on nor joined a team of someone else', async () => {
    expect(await on(billing.id, 'member_1')).toEqual({
      actsOn: false,
      joined: false,
    });
  });

  it('says a person outside the workspace neither acts on nor joined its team', async () => {
    expect(await on(platform.id, 'stranger_1')).toEqual({
      actsOn: false,
      joined: false,
    });
  });

  it('says a token, even one issued by a member, never joined the team', async () => {
    const access = await accessIn(acme).access.accessOnTeam(
      platform.id,
      IssuedTokenGrant.principal({
        tokenId: WorkspaceTokenId.of('token_1'),
        workspaceId: acme.id,
        scopes: TokenScopes.named(['read']),
        issuedBy: UserId.of('member_1'),
      }),
    );

    expect(access).toEqual({ actsOn: true, joined: false });
  });

  it('says nobody acts on a team that does not exist', async () => {
    expect(await on(TeamId.of('team_gone'), 'owner_1')).toEqual({
      actsOn: false,
      joined: false,
    });
  });
});
