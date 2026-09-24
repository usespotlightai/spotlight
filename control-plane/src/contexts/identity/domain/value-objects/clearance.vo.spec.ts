import { Clearance } from '@identity/domain/value-objects/clearance.vo';
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

describe('Clearance of a token’s scopes', () => {
  const granted = (scopes: readonly string[]) => {
    const cleared = Clearance.ofScopes(TokenScopes.named(scopes));

    return {
      reads: cleared.reads,
      plans: cleared.plans,
      configures: cleared.configures,
      managesSecrets: cleared.managesSecrets,
      managesRunners: cleared.managesRunners,
      administers: cleared.administers,
    };
  };

  it.each([
    [['read'], false, false],
    [['plan'], true, false],
    [['configure'], true, true],
    [['read', 'configure'], true, true],
  ])(
    'climbs the ladder for %j without managing secrets or runners, or administering',
    (scopes, plans, configures) => {
      expect(granted(scopes)).toEqual({
        reads: true,
        plans,
        configures,
        managesSecrets: false,
        managesRunners: false,
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
});

describe('Clearance beyond any one workspace', () => {
  it('lets a person plan and open workspaces', () => {
    const cleared = Clearance.beyondWorkspaces(
      PersonPrincipal.of(UserId.of('user_1')),
    );

    expect([cleared.plans, cleared.opensWorkspaces]).toEqual([true, true]);
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
      const cleared = Clearance.beyondWorkspaces(token(scopes));

      expect([cleared.plans, cleared.opensWorkspaces, cleared.reads]).toEqual([
        plans,
        false,
        false,
      ]);
    },
  );
});
