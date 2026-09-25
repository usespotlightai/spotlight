import { TokenBearers } from '@identity/application/services/token-bearers.service';
import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-25T10:00:00.000Z');
const MAIN = 'repo:acme/platform:ref:refs/heads/main';
const ISSUER = 'https://token.actions.githubusercontent.com';

const trustAt = (version: number) =>
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
    scopes: TokenScopes.named(['configure']),
    lifetime: TokenLifetime.ofMinutes(15),
    definedBy: UserId.of('admin_1'),
    version,
  });

const MINTED = trustAt(1).mintFor(
  { issuer: ISSUER, subject: MAIN, audiences: ['spotlight'], named: {} },
  {
    id: WorkspaceTokenId.of('token_1'),
    hash: TokenHash.of('d'.repeat(64)),
    now: NOW,
    client: Client.named('web'),
  },
);

const bearers = (
  token: WorkspaceToken | null,
  trust: WorkspaceTokenTrust | null,
  at = NOW,
) =>
  new TokenBearers(
    {
      bearing: vi.fn(async () => token),
    } as unknown as WorkspaceTokenRepository,
    {
      find: vi.fn(async () => trust),
    } as unknown as WorkspaceTokenTrustRepository,
    { hash: () => 'd'.repeat(64) } as unknown as TokenMintPort,
    { now: () => at, sleep: async () => {} },
  );

describe('TokenBearers', () => {
  it('knows a minted token while its trust stands as it was', async () => {
    expect(await bearers(MINTED, trustAt(1)).identify('bearer')).toMatchObject({
      trustId: WorkspaceTokenTrustId.of('trust_1'),
    });
  });

  it('knows no minted token once its trust is gone or has changed', async () => {
    expect(await bearers(MINTED, null).identify('bearer')).toBeNull();
    expect(await bearers(MINTED, trustAt(2)).identify('bearer')).toBeNull();
  });

  it('knows no token once it has expired', async () => {
    expect(
      await bearers(
        MINTED,
        trustAt(1),
        new Date('2026-09-25T10:15:00.000Z'),
      ).identify('bearer'),
    ).toBeNull();
  });

  it('knows no bearer it never issued', async () => {
    expect(await bearers(null, null).identify('bearer')).toBeNull();
  });
});
