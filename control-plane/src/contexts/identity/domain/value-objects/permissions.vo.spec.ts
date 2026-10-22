import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { describe, expect, it } from 'vitest';

const token = (scopes: readonly string[]) =>
  TokenPrincipal.of({
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
      managesSecrets: permissions.managesSecrets,
      managesRunners: permissions.managesRunners,
      managesOidcTrusts: permissions.managesOidcTrusts,
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
