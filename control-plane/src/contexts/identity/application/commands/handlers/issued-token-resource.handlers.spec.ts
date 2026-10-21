import { DeleteOidcTrustHandler } from '@identity/application/commands/handlers/delete-oidc-trust.handler';
import { DeleteWorkspaceTokenHandler } from '@identity/application/commands/handlers/delete-workspace-token.handler';
import { UpdateWorkspaceTokenHandler } from '@identity/application/commands/handlers/update-workspace-token.handler';
import { DeleteOidcTrustCommand } from '@identity/application/commands/oidc-trust.commands';
import {
  DeleteWorkspaceTokenCommand,
  UpdateWorkspaceTokenCommand,
} from '@identity/application/commands/workspace-token.commands';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { access, transaction } from '@identity/identity.resources.fake-spec';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ISSUER = 'https://token.actions.githubusercontent.com';
const MAIN = 'repo:acme/platform:ref:refs/heads/main';

const trust = () =>
  OidcTrust.rehydrate({
    id: OidcTrustId.of('trust_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: OidcTrustKey.of('github-main'),
    workload: WorkloadRule.of({
      issuer: ISSUER,
      audience: 'spotlight',
      subject: MAIN,
      claims: {},
    }),
    scopes: TokenScopes.named(['configure', 'secrets']),
    lifetime: TokenLifetime.ofMinutes(15),
    createdBy: UserId.of('user_1'),
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    version: 0,
  });

const issued = () => {
  const token = trust().issueFor(
    {
      issuer: ISSUER,
      subject: MAIN,
      audiences: ['spotlight'],
      customClaims: {},
    },
    {
      id: WorkspaceTokenId.of('token_9'),
      hash: TokenHash.of('b'.repeat(64)),
      now: new Date('2026-09-25T10:00:00.000Z'),
      client: Client.named('web'),
    },
  );
  token.pullEvents();

  return token;
};

const tokens = () => {
  const save = vi.fn(async (_: WorkspaceToken) => {});

  return {
    save,
    repository: {
      find: vi.fn(async () => issued()),
      save,
    } as unknown as WorkspaceTokenRepository,
  };
};

describe('an issued token as a resource', () => {
  it('is revoked by an admin, one token alone', async () => {
    const { repository, save } = tokens();
    const handler = new DeleteWorkspaceTokenHandler(
      access(),
      repository,
      transaction,
    );

    expect(
      await handler.execute(
        new DeleteWorkspaceTokenCommand('token_9', actorFor(), 0),
      ),
    ).toEqual({ outcome: 'deleted' });
    expect(save.mock.calls[0]?.[0].isRevoked).toBe(true);
  });

  it('is never described anew, saying why', async () => {
    const { repository, save } = tokens();
    const handler = new UpdateWorkspaceTokenHandler(
      access(),
      new IdentityDefinitions(),
      repository,
      transaction,
    );

    expect(
      await handler.execute(
        new UpdateWorkspaceTokenCommand('token_9', actorFor(), 0, {
          name: 'github-main',
          description: 'renamed',
          scopes: ['configure', 'secrets'],
          expiresAt: '2026-09-25T10:15:00.000Z',
        }),
      ),
    ).toMatchObject({
      outcome: 'invalid',
      problems: [
        expect.objectContaining({
          reason: expect.stringContaining('Spotlight issued'),
        }),
      ],
    });
    expect(save).not.toHaveBeenCalled();
  });
});

describe('DeleteOidcTrustHandler', () => {
  const deleting = (scopes: string[]) => {
    const save = vi.fn(async (_: OidcTrust) => {});
    const handler = new DeleteOidcTrustHandler(
      {
        permissionsIn: vi.fn(async () => ({
          workspaceId: WorkspaceId.of('ws_1'),
          managesOidcTrusts: true,
        })),
      } as unknown as WorkspaceAccessPort,
      {
        find: vi.fn(async () => trust()),
        save,
      } as unknown as OidcTrustRepository,
      transaction,
    );
    const by = Actor.of(
      TokenPrincipal.of({
        tokenId: WorkspaceTokenId.of('token_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        scopes: TokenScopes.named(scopes),
        issuedBy: UserId.of('user_1'),
      }),
      Client.named('terraform-provider/0.2.0'),
    );

    return {
      save,
      remove: () =>
        handler.execute(new DeleteOidcTrustCommand('trust_1', by, 0)),
    };
  };

  it('forbids a token deleting a trust that grants more than the token has', async () => {
    const { remove, save } = deleting(['plan', 'trusts']);

    expect(await remove()).toEqual(forbiddenTo('trusts'));
    expect(save).not.toHaveBeenCalled();
  });

  it('lets a token delete a trust within what it has', async () => {
    const { remove, save } = deleting(['configure', 'secrets', 'trusts']);

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect(save.mock.calls[0]?.[0].isDeleted).toBe(true);
  });
});
