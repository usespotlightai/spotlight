import { IssuedTokenGrant } from '@identity/domain/value-objects/issued-token-grant.vo';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import { TokenScope } from '@identity/domain/value-objects/token-scope.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const token = (scopes: readonly string[]) =>
  IssuedTokenGrant.principal({
    tokenId: WorkspaceTokenId.of('token_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    scopes: TokenScopes.named(scopes),
    issuedBy: UserId.of('user_1'),
  });

describe('Permissions of a token’s scopes', () => {
  const granted = (scopes: readonly string[]) => {
    const permissions = Permissions.ofScopes(TokenScopes.named(scopes));

    return {
      reads: permissions.reads,
      plans: permissions.plans,
      configures: permissions.configures,
      managesSecrets: permissions.allows(TokenScope.secrets),
      managesRunners: permissions.allows(TokenScope.runners),
      managesOidcTrusts: permissions.allows(TokenScope.trusts),
      isAdmin: permissions.isAdmin,
    };
  };

  it.each([
    [['read'], false, false],
    [['plan'], true, false],
    [['configure'], true, true],
    [['read', 'configure'], true, true],
  ])(
    'climbs the ladder for %j without managing secrets, runners or OIDC trusts, or administering',
    (scopes, plans, configures) => {
      expect(granted(scopes)).toEqual({
        reads: true,
        plans,
        configures,
        managesSecrets: false,
        managesRunners: false,
        managesOidcTrusts: false,
        isAdmin: false,
      });
    },
  );

  it.each([
    [['read', 'secrets'], false],
    [['configure', 'secrets'], true],
  ])(
    'manages secrets for %j, and is still never an admin',
    (scopes, configures) => {
      expect(granted(scopes)).toMatchObject({
        reads: true,
        configures,
        managesSecrets: true,
        managesRunners: false,
        isAdmin: false,
      });
    },
  );

  it.each([
    [['read', 'runners'], false],
    [['configure', 'runners'], true],
  ])(
    'manages runners for %j, without secrets, and is still never an admin',
    (scopes, configures) => {
      expect(granted(scopes)).toMatchObject({
        reads: true,
        configures,
        managesSecrets: false,
        managesRunners: true,
        isAdmin: false,
      });
    },
  );

  it.each([
    [['read', 'trusts'], false],
    [['configure', 'trusts'], true],
  ])(
    'manages OIDC trusts for %j, without secrets or runners, and is still never an admin',
    (scopes, configures) => {
      expect(granted(scopes)).toEqual({
        reads: true,
        plans: configures,
        configures,
        managesSecrets: false,
        managesRunners: false,
        managesOidcTrusts: true,
        isAdmin: false,
      });
    },
  );
});

describe('The scopes permissions allow', () => {
  it('names the scopes a role or a token is allowed, and no more', () => {
    const named = (permissions: Permissions) =>
      permissions.allowedScopes.map((scope) => scope.value);

    expect(named(Permissions.ofRole(WorkspaceRole.member))).toEqual([
      'read',
      'plan',
    ]);
    expect(named(Permissions.ofRole(WorkspaceRole.admin))).toEqual([
      'read',
      'plan',
      'configure',
      'secrets',
      'runners',
      'trusts',
    ]);
    expect(named(Permissions.none)).toEqual([]);
  });
});

describe('Permissions beyond any one workspace', () => {
  it('lets a person plan and create workspaces', () => {
    const permissions = Permissions.global(
      PersonPrincipal.of(UserId.of('user_1')),
    );

    expect([permissions.plans, permissions.createsWorkspaces]).toEqual([
      true,
      true,
    ]);
  });

  it.each([
    [['read'], false],
    [['read', 'secrets'], false],
    [['read', 'runners'], false],
    [['plan'], true],
    [['configure', 'secrets'], true],
  ])(
    'lets a %j token plan only as its scopes allow, and never create a workspace',
    (scopes, plans) => {
      const permissions = Permissions.global(token(scopes));

      expect([
        permissions.plans,
        permissions.createsWorkspaces,
        permissions.reads,
      ]).toEqual([plans, false, false]);
    },
  );
});

describe('Seeing how OIDC trusts are used', () => {
  it('is for owners and admins, never for members or any token', () => {
    expect(Permissions.ofRole(WorkspaceRole.admin).seesOidcTrustUsage).toBe(
      true,
    );
    expect(Permissions.ofRole(WorkspaceRole.member).seesOidcTrustUsage).toBe(
      false,
    );
    expect(
      Permissions.ofScopes(
        TokenScopes.named(['configure', 'secrets', 'runners', 'trusts']),
      ).seesOidcTrustUsage,
    ).toBe(false);
  });
});
