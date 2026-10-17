import { DeleteWorkspaceTokenHandler } from '@identity/application/commands/handlers/delete-workspace-token.handler';
import { DeleteWorkspaceTokenTrustHandler } from '@identity/application/commands/handlers/delete-workspace-token-trust.handler';
import { UpdateWorkspaceTokenHandler } from '@identity/application/commands/handlers/update-workspace-token.handler';
import {
  DeleteWorkspaceTokenCommand,
  UpdateWorkspaceTokenCommand,
} from '@identity/application/commands/workspace-token.commands';
import { DeleteWorkspaceTokenTrustCommand } from '@identity/application/commands/workspace-token-trust.commands';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { access, transaction } from '@identity/identity.resources.fake-spec';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ISSUER = 'https://token.actions.githubusercontent.com';
const MAIN = 'repo:acme/platform:ref:refs/heads/main';

const trust = () =>
  WorkspaceTokenTrust.rehydrate({
    id: WorkspaceTokenTrustId.of('trust_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: TokenTrustKey.of('github-main'),
    workload: WorkloadRule.of({
      issuer: ISSUER,
      audience: 'spotlight',
      subject: MAIN,
      claims: {},
    }),
    scopes: TokenScopes.named(['configure', 'secrets']),
    lifetime: TokenLifetime.ofMinutes(15),
    definedBy: UserId.of('user_1'),
    version: 0,
  });

const minted = () => {
  const token = trust().mintFor(
    { issuer: ISSUER, subject: MAIN, audiences: ['spotlight'], named: {} },
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
      find: vi.fn(async () => minted()),
      save,
    } as unknown as WorkspaceTokenRepository,
  };
};

describe('a minted token as a resource', () => {
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
          reason: expect.stringContaining('Spotlight minted'),
        }),
      ],
    });
    expect(save).not.toHaveBeenCalled();
  });
});

describe('DeleteWorkspaceTokenTrustHandler', () => {
  const withdrawing = (scopes: string[]) => {
    const save = vi.fn(async (_: WorkspaceTokenTrust) => {});
    const handler = new DeleteWorkspaceTokenTrustHandler(
      {
        permissionsIn: vi.fn(async () => ({
          workspaceId: WorkspaceId.of('ws_1'),
          managesTokenTrusts: true,
        })),
      } as unknown as WorkspaceAccessPort,
      {
        find: vi.fn(async () => trust()),
        save,
      } as unknown as WorkspaceTokenTrustRepository,
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
      withdraw: () =>
        handler.execute(new DeleteWorkspaceTokenTrustCommand('trust_1', by, 0)),
    };
  };

  it('forbids a token withdrawing a trust that grants more than the token holds', async () => {
    const { withdraw, save } = withdrawing(['plan', 'trusts']);

    expect(await withdraw()).toEqual(forbiddenTo('manage-token-trusts'));
    expect(save).not.toHaveBeenCalled();
  });

  it('lets a token withdraw a trust within what it holds', async () => {
    const { withdraw, save } = withdrawing(['configure', 'secrets', 'trusts']);

    expect(await withdraw()).toEqual({ outcome: 'deleted' });
    expect(save.mock.calls[0]?.[0].isWithdrawn).toBe(true);
  });
});
