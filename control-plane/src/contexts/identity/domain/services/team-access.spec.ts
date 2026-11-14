import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { TeamAccess } from '@identity/domain/services/team-access';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { IssuedTokenGrant } from '@identity/domain/value-objects/issued-token-grant.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const OWNER = UserId.of('owner_1');
const ADMIN = UserId.of('admin_1');
const ON_PLATFORM = UserId.of('ada');
const ON_PAYMENTS = UserId.of('bob');
const OUTSIDER = UserId.of('eve');

const ACME = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme Inc.'),
  slug: WorkspaceSlug.of('acme-inc'),
  members: [
    { userId: OWNER, role: WorkspaceRole.owner },
    { userId: ADMIN, role: WorkspaceRole.admin },
    { userId: ON_PLATFORM, role: WorkspaceRole.member },
    { userId: ON_PAYMENTS, role: WorkspaceRole.member },
  ],
  version: 0,
});

const team = (name: string, members: readonly UserId[], workspace = 'ws_1') =>
  Team.rehydrate({
    id: TeamId.of(`team_${name.toLowerCase()}`),
    workspaceId: WorkspaceId.of(workspace),
    key: TeamKey.from(name),
    name: TeamName.of(name),
    origin: 'configuration',
    members,
    version: 0,
  });

const PLATFORM = team('Platform', [OWNER, ON_PLATFORM]);

const tokenOf = (scopes: readonly string[], workspace = 'ws_1') =>
  IssuedTokenGrant.principal({
    tokenId: WorkspaceTokenId.of('token_1'),
    workspaceId: WorkspaceId.of(workspace),
    scopes: TokenScopes.named(scopes),
    issuedBy: ADMIN,
  });

const allows = (principal: PersonPrincipal | TokenPrincipal, of = PLATFORM) =>
  TeamAccess.actsOnTeam(of, ACME, principal);

const inWorkspace = (
  principal: PersonPrincipal | TokenPrincipal,
  of = PLATFORM,
) => TeamAccess.permissionsInWorkspaceOf(of, ACME, principal);

describe('TeamAccess, in the workspace of a team', () => {
  it('grants a workspace member who is only on another team what their role grants', () => {
    expect(inWorkspace(PersonPrincipal.of(ON_PAYMENTS)).reads).toBe(true);
    expect(inWorkspace(PersonPrincipal.of(ON_PAYMENTS)).isAdmin).toBe(false);
    expect(inWorkspace(PersonPrincipal.of(ADMIN)).isAdmin).toBe(true);
  });

  it('grants a token of the workspace what its scopes grant', () => {
    expect(inWorkspace(tokenOf(['read'])).reads).toBe(true);
    expect(inWorkspace(tokenOf(['read'])).configures).toBe(false);
  });

  it('grants nothing to someone outside the workspace', () => {
    expect(inWorkspace(PersonPrincipal.of(OUTSIDER)).reads).toBe(false);
  });

  it('grants nothing for a team of another workspace, or a deleted team', () => {
    expect(
      inWorkspace(PersonPrincipal.of(ADMIN), team('Platform', [ADMIN], 'ws_2'))
        .reads,
    ).toBe(false);
    expect(
      inWorkspace(
        PersonPrincipal.of(ADMIN),
        PLATFORM.delete(Dependents.none(), changeActorIn(ACME.id)),
      ).reads,
    ).toBe(false);
  });
});

describe('TeamAccess, reading a team', () => {
  it('allows a member of the team', () => {
    expect(allows(PersonPrincipal.of(ON_PLATFORM))).toBe(true);
  });

  it('allows an admin of the workspace who is not on the team', () => {
    expect(allows(PersonPrincipal.of(ADMIN))).toBe(true);
  });

  it('turns away a workspace member who is only on another team', () => {
    expect(allows(PersonPrincipal.of(ON_PAYMENTS))).toBe(false);
  });

  it('turns away someone outside the workspace', () => {
    expect(allows(PersonPrincipal.of(OUTSIDER))).toBe(false);
  });

  it('turns away a team member once they have left the workspace', () => {
    expect(
      allows(PersonPrincipal.of(OUTSIDER), team('Platform', [OUTSIDER])),
    ).toBe(false);
  });

  it('allows a token of the workspace that may read', () => {
    expect(allows(tokenOf(['read']))).toBe(true);
  });

  it('turns away a token of another workspace', () => {
    expect(allows(tokenOf(['read'], 'ws_2'))).toBe(false);
  });

  it('turns away anyone for a team of another workspace', () => {
    expect(
      allows(PersonPrincipal.of(ADMIN), team('Platform', [ADMIN], 'ws_2')),
    ).toBe(false);
  });
});

describe('TeamAccess, joining a team', () => {
  const joins = (principal: PersonPrincipal | TokenPrincipal) =>
    TeamAccess.joinedTeam(PLATFORM, ACME, principal);

  it('counts a member of the team who acts on it', () => {
    expect(joins(PersonPrincipal.of(ON_PLATFORM))).toBe(true);
    expect(joins(PersonPrincipal.of(OWNER))).toBe(true);
  });

  it('does not count an admin of the workspace who is not on the team', () => {
    expect(joins(PersonPrincipal.of(ADMIN))).toBe(false);
  });

  it('does not count a member of another team or a token', () => {
    expect(joins(PersonPrincipal.of(ON_PAYMENTS))).toBe(false);
    expect(joins(tokenOf(['read', 'plan']))).toBe(false);
  });
});
