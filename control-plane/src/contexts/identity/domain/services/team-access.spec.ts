import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { TeamAccess } from '@identity/domain/services/team-access';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
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
    members,
    version: 0,
  });

const PLATFORM = team('Platform', [OWNER, ON_PLATFORM]);

const tokenOf = (scopes: readonly string[], workspace = 'ws_1') =>
  TokenPrincipal.of({
    tokenId: WorkspaceTokenId.of('token_1'),
    workspaceId: WorkspaceId.of(workspace),
    scopes: TokenScopes.named(scopes),
    issuedBy: ADMIN,
  });

const admits = (principal: PersonPrincipal | TokenPrincipal, of = PLATFORM) =>
  TeamAccess.admits(of, ACME, principal);

describe('TeamAccess', () => {
  it('admits a member of the team', () => {
    expect(admits(PersonPrincipal.of(ON_PLATFORM))).toBe(true);
  });

  it('admits an admin of the workspace who is not on the team', () => {
    expect(admits(PersonPrincipal.of(ADMIN))).toBe(true);
  });

  it('turns away a workspace member who is only on another team', () => {
    expect(admits(PersonPrincipal.of(ON_PAYMENTS))).toBe(false);
  });

  it('turns away someone outside the workspace', () => {
    expect(admits(PersonPrincipal.of(OUTSIDER))).toBe(false);
  });

  it('turns away a team member once they have left the workspace', () => {
    expect(
      admits(PersonPrincipal.of(OUTSIDER), team('Platform', [OUTSIDER])),
    ).toBe(false);
  });

  it('admits a token of the workspace that may read', () => {
    expect(admits(tokenOf(['read']))).toBe(true);
  });

  it('turns away a token of another workspace', () => {
    expect(admits(tokenOf(['read'], 'ws_2'))).toBe(false);
  });

  it('turns away anyone for a team held by another workspace', () => {
    expect(
      admits(PersonPrincipal.of(ADMIN), team('Platform', [ADMIN], 'ws_2')),
    ).toBe(false);
  });
});
