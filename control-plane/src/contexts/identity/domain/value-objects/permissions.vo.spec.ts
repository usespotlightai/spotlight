import { Permissions } from '@identity/domain/value-objects/permissions.vo';
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
      managesTokenTrusts: permissions.managesTokenTrusts,
      administers: permissions.administers,
    };
  };

  it.each([
    [['read'], false, false],
    [['plan'], true, false],
    [['configure'], true, true],
    [['read', 'configure'], true, true],
  ])(
    'climbs the ladder for %j without managing secrets, runners or token trusts, or administering',
    (scopes, plans, configures) => {
      expect(granted(scopes)).toEqual({
        reads: true,
        plans,
        configures,
        managesSecrets: false,
        managesRunners: false,
        managesTokenTrusts: false,
        administers: false,
      });
    },
  );

  it.each([
    [['read', 'secrets'], false],
    [['configure', 'secrets'], true],
  ])(
    'manages secrets for %j, and still never administers',
    (scopes, configures) => {
      expect(granted(scopes)).toMatchObject({
        reads: true,
        configures,
        managesSecrets: true,
        managesRunners: false,
        administers: false,
      });
    },
  );

  it.each([
    [['read', 'runners'], false],
    [['configure', 'runners'], true],
  ])(
    'manages runners for %j, without secrets, and still never administers',
    (scopes, configures) => {
      expect(granted(scopes)).toMatchObject({
        reads: true,
        configures,
        managesSecrets: false,
        managesRunners: true,
        administers: false,
      });
    },
  );

  it.each([
    [['read', 'trusts'], false],
    [['configure', 'trusts'], true],
  ])(
    'manages token trusts for %j, without secrets or runners, and still never administers',
    (scopes, configures) => {
      expect(granted(scopes)).toEqual({
        reads: true,
        plans: configures,
        configures,
        managesSecrets: false,
        managesRunners: false,
        managesTokenTrusts: true,
        administers: false,
      });
    },
  );
});

describe('Permissions beyond any one workspace', () => {
  it('lets a person plan and open workspaces', () => {
    const permissions = Permissions.beyondWorkspaces(
      PersonPrincipal.of(UserId.of('user_1')),
    );

    expect([permissions.plans, permissions.opensWorkspaces]).toEqual([
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
    'lets a %j token plan only as its scopes allow, and never open a workspace',
    (scopes, plans) => {
      const permissions = Permissions.beyondWorkspaces(token(scopes));

      expect([
        permissions.plans,
        permissions.opensWorkspaces,
        permissions.reads,
      ]).toEqual([plans, false, false]);
    },
  );
});
